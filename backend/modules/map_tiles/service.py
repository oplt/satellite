from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import HTTPException

from backend.core.config import settings
from backend.core.storage import ObjectStorage, ObjectStorageError, object_storage

logger = logging.getLogger(__name__)

TILE_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
TILE_TIMEOUT_SECONDS = 20.0


@dataclass(frozen=True, slots=True)
class TileProvider:
    template: str
    extension: str
    max_zoom: int
    subdomains: tuple[str, ...] = ()


@dataclass(slots=True)
class MapTile:
    provider: str
    z: int
    x: int
    y: int
    content: bytes
    content_type: str
    created_at: datetime


@dataclass(slots=True)
class _MemoryTile:
    tile: MapTile
    expires_at: datetime


PROVIDERS = {
    "openstreetmap": TileProvider(
        template="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        extension="png",
        max_zoom=19,
        subdomains=("a", "b", "c"),
    ),
    "vlaamse-orthophoto": TileProvider(
        template=(
            "https://geo.api.vlaanderen.be/OFW/wmts?"
            "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ofw&STYLE="
            "&FORMAT=image/png&TILEMATRIXSET=GoogleMapsVL"
            "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"
        ),
        extension="png",
        max_zoom=21,
    ),
}


class MapTileService:
    def __init__(self, storage: ObjectStorage | None = None) -> None:
        self.storage = storage or object_storage
        self._memory_cache: dict[str, _MemoryTile] = {}
        self._lock = asyncio.Lock()
        self.timeout = httpx.Timeout(timeout=TILE_TIMEOUT_SECONDS, connect=5.0)

    async def get_tile(self, *, provider_name: str, z: int, x: int, y: int) -> MapTile:
        provider = self._get_provider(provider_name)
        self._validate_tile(provider=provider, z=z, x=x, y=y)

        object_key = self._object_key(provider_name=provider_name, provider=provider, z=z, x=x, y=y)
        cached = await self._get_memory_tile(object_key)
        if cached is not None:
            return cached

        stored = await self._get_storage_tile(
            object_key=object_key,
            provider_name=provider_name,
            z=z,
            x=x,
            y=y,
        )
        if stored is not None:
            await self._set_memory_tile(object_key, stored)
            return stored

        tile = await self._fetch_tile(provider_name=provider_name, provider=provider, z=z, x=x, y=y)
        await self._set_memory_tile(object_key, tile)
        await self._store_tile(object_key, tile)
        return tile

    def _get_provider(self, provider_name: str) -> TileProvider:
        provider = PROVIDERS.get(provider_name)
        if provider is None:
            raise HTTPException(status_code=404, detail="Map tile provider not found")
        return provider

    @staticmethod
    def _validate_tile(*, provider: TileProvider, z: int, x: int, y: int) -> None:
        if z < 0 or z > provider.max_zoom:
            raise HTTPException(status_code=422, detail="Tile zoom is out of range")

        max_tile = 2**z
        if x < 0 or y < 0 or x >= max_tile or y >= max_tile:
            raise HTTPException(status_code=422, detail="Tile coordinates are out of range")

    async def _get_memory_tile(self, object_key: str) -> MapTile | None:
        async with self._lock:
            entry = self._memory_cache.get(object_key)
            if entry is None:
                return None
            if entry.expires_at <= datetime.now(UTC):
                self._memory_cache.pop(object_key, None)
                return None
            return entry.tile

    async def _set_memory_tile(self, object_key: str, tile: MapTile) -> None:
        async with self._lock:
            self._memory_cache[object_key] = _MemoryTile(
                tile=tile,
                expires_at=datetime.now(UTC) + timedelta(seconds=TILE_CACHE_TTL_SECONDS),
            )

    async def _get_storage_tile(
        self,
        *,
        object_key: str,
        provider_name: str,
        z: int,
        x: int,
        y: int,
    ) -> MapTile | None:
        if not self.storage.is_configured:
            return None

        try:
            downloaded = await self.storage.download_bytes(object_key)
        except ObjectStorageError:
            logger.exception("Failed to read map tile %s from object storage", object_key)
            return None

        if downloaded is None:
            return None

        content, content_type = downloaded
        return MapTile(
            provider=provider_name,
            z=z,
            x=x,
            y=y,
            content=content,
            content_type=content_type,
            created_at=datetime.now(UTC),
        )

    async def _store_tile(self, object_key: str, tile: MapTile) -> None:
        if not self.storage.is_configured:
            return

        try:
            await self.storage.upload_bytes(
                object_key=object_key,
                body=tile.content,
                content_type=tile.content_type,
            )
        except ObjectStorageError:
            logger.exception("Failed to write map tile %s to object storage", object_key)

    async def _fetch_tile(
        self,
        *,
        provider_name: str,
        provider: TileProvider,
        z: int,
        x: int,
        y: int,
    ) -> MapTile:
        url = self._tile_url(provider=provider, z=z, x=x, y=y)
        try:
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(
                    url,
                    headers={"User-Agent": f"{settings.APP_NAME}/map-tile-cache"},
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "Map tile provider %s returned %s for z=%s x=%s y=%s",
                provider_name,
                exc.response.status_code,
                z,
                x,
                y,
            )
            raise HTTPException(status_code=502, detail="Map tile provider request failed") from exc
        except httpx.HTTPError as exc:
            logger.warning(
                "Map tile provider %s failed for z=%s x=%s y=%s",
                provider_name,
                z,
                x,
                y,
            )
            raise HTTPException(status_code=502, detail="Map tile provider request failed") from exc

        return MapTile(
            provider=provider_name,
            z=z,
            x=x,
            y=y,
            content=response.content,
            content_type=response.headers.get("content-type", "image/png"),
            created_at=datetime.now(UTC),
        )

    @staticmethod
    def _tile_url(*, provider: TileProvider, z: int, x: int, y: int) -> str:
        subdomain = ""
        if provider.subdomains:
            subdomain = provider.subdomains[(x + y + z) % len(provider.subdomains)]
        return provider.template.format(s=subdomain, z=z, x=x, y=y)

    @staticmethod
    def _object_key(*, provider_name: str, provider: TileProvider, z: int, x: int, y: int) -> str:
        return f"map-tiles/{provider_name}/{z}/{x}/{y}.{provider.extension}"


map_tile_service = MapTileService()
