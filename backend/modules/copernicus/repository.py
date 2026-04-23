from __future__ import annotations

import asyncio
import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Generic, TypeVar

from backend.core.config import settings
from backend.modules.copernicus.models import AuthTokenRecord, RenderCacheRecord, StoredAsset


T = TypeVar("T")


@dataclass(slots=True)
class _CacheEntry(Generic[T]):
    value: T
    expires_at: datetime


class TTLCache(Generic[T]):
    def __init__(self) -> None:
        self._store: dict[str, _CacheEntry[T]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> T | None:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if entry.expires_at <= datetime.now(UTC):
                self._store.pop(key, None)
                return None
            return entry.value

    async def set(self, key: str, value: T, ttl_seconds: int) -> None:
        async with self._lock:
            self._store[key] = _CacheEntry(
                value=value,
                expires_at=datetime.now(UTC) + timedelta(seconds=ttl_seconds),
            )

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._store.pop(key, None)

    async def size(self) -> int:
        async with self._lock:
            expired = [
                key for key, entry in self._store.items() if entry.expires_at <= datetime.now(UTC)
            ]
            for key in expired:
                self._store.pop(key, None)
            return len(self._store)


def normalize_bbox_for_cache(
    bbox: tuple[float, float, float, float],
    precision: int | None = None,
) -> tuple[float, float, float, float]:
    rounded_precision = precision if precision is not None else settings.COPERNICUS_CACHE_BBOX_PRECISION
    return tuple(round(value, rounded_precision) for value in bbox)


def stable_cache_hash(parts: dict[str, Any]) -> str:
    payload = json.dumps(parts, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]


def build_search_cache_key(
    *,
    bbox: tuple[float, float, float, float],
    start_date: str,
    end_date: str,
    collection: str,
    cloud_threshold: int,
) -> str:
    normalized_bbox = normalize_bbox_for_cache(bbox)
    return stable_cache_hash(
        {
            "bbox": normalized_bbox,
            "collection": collection,
            "cloud_threshold": cloud_threshold,
            "end_date": end_date,
            "start_date": start_date,
        }
    )


def build_render_cache_key(
    *,
    bbox: tuple[float, float, float, float],
    start_date: str,
    end_date: str,
    collection: str,
    layer: str,
    width: int,
    height: int,
    scene_id: str,
    render_profile: str = "v1",
) -> str:
    normalized_bbox = normalize_bbox_for_cache(bbox)
    return stable_cache_hash(
        {
            "bbox": normalized_bbox,
            "collection": collection,
            "end_date": end_date,
            "height": height,
            "layer": layer,
            "render_profile": render_profile,
            "scene_id": scene_id,
            "start_date": start_date,
            "width": width,
        }
    )


def build_asset_id(render_key: str) -> str:
    return stable_cache_hash({"render_key": render_key})


class CopernicusRepository:
    def __init__(self) -> None:
        self._token_cache: TTLCache[AuthTokenRecord] = TTLCache()
        self._search_cache: TTLCache[list[Any]] = TTLCache()
        self._render_cache: TTLCache[RenderCacheRecord] = TTLCache()
        self._asset_cache: TTLCache[StoredAsset] = TTLCache()

    @property
    def backend(self) -> str:
        return "memory"

    async def get_token(self, key: str) -> AuthTokenRecord | None:
        return await self._token_cache.get(key)

    async def set_token(self, key: str, value: AuthTokenRecord, ttl_seconds: int) -> None:
        await self._token_cache.set(key, value, ttl_seconds)

    async def get_search_results(self, key: str) -> list[Any] | None:
        return await self._search_cache.get(key)

    async def set_search_results(self, key: str, value: list[Any], ttl_seconds: int) -> None:
        await self._search_cache.set(key, value, ttl_seconds)

    async def get_render(self, key: str) -> RenderCacheRecord | None:
        return await self._render_cache.get(key)

    async def set_render(self, key: str, value: RenderCacheRecord, ttl_seconds: int) -> None:
        await self._render_cache.set(key, value, ttl_seconds)

    async def get_asset(self, asset_id: str) -> StoredAsset | None:
        return await self._asset_cache.get(asset_id)

    async def set_asset(self, asset_id: str, value: StoredAsset, ttl_seconds: int) -> None:
        await self._asset_cache.set(asset_id, value, ttl_seconds)

    async def diagnostics(self) -> dict[str, int]:
        return {
            "tokens": await self._token_cache.size(),
            "searches": await self._search_cache.size(),
            "renders": await self._render_cache.size(),
            "assets": await self._asset_cache.size(),
        }


copernicus_repository = CopernicusRepository()
