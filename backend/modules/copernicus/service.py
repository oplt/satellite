from __future__ import annotations

import base64
import logging
from datetime import UTC, datetime, timedelta
from math import atan, degrees, pi, sinh

import httpx
from fastapi import HTTPException

from backend.core.config import settings
from backend.modules.copernicus.builder import (
    build_catalog_search_payload,
    build_process_payload,
)
from backend.modules.copernicus.models import (
    AuthTokenRecord,
    RenderCacheRecord,
    SatelliteLayerMode,
    SceneRecord,
    StoredAsset,
    SUPPORTED_COLLECTIONS,
)
from backend.modules.copernicus.repository import (
    CopernicusRepository,
    build_asset_id,
    build_render_cache_key,
    build_search_cache_key,
    copernicus_repository,
)
from backend.modules.copernicus.schemas import (
    BBox,
    CacheMetadataResponse,
    DateRange,
    ImageAssetResponse,
    LatestImageRequest,
    LatestImageResponse,
    RenderImageRequest,
    RenderImageResponse,
    SatelliteHealthResponse,
    SceneMetadataResponse,
)


logger = logging.getLogger(__name__)
RENDER_PROFILE = "mercator-v1"


class CopernicusService:
    def __init__(
        self,
        repository: CopernicusRepository | None = None,
    ) -> None:
        self.repository = repository or copernicus_repository
        self.timeout = httpx.Timeout(
            timeout=settings.COPERNICUS_HTTP_TIMEOUT_SECONDS,
            connect=min(10.0, settings.COPERNICUS_HTTP_TIMEOUT_SECONDS),
        )

    def _ensure_configured(self) -> None:
        missing = []
        if not settings.COPERNICUS_CLIENT_ID:
            missing.append("COPERNICUS_CLIENT_ID")
        if not settings.COPERNICUS_CLIENT_SECRET:
            missing.append("COPERNICUS_CLIENT_SECRET")
        if missing:
            raise HTTPException(
                status_code=503,
                detail=f"Copernicus integration is not configured: missing {', '.join(missing)}",
            )

    async def get_health(self) -> SatelliteHealthResponse:
        configured = bool(settings.COPERNICUS_CLIENT_ID and settings.COPERNICUS_CLIENT_SECRET)
        token_cached = (
            await self.repository.get_token(self._token_cache_key()) is not None
        )
        return SatelliteHealthResponse(
            status="ok" if configured else "degraded",
            configured=configured,
            default_collection=settings.COPERNICUS_DEFAULT_COLLECTION,
            default_country=settings.COPERNICUS_DEFAULT_COUNTRY,
            cache_backend=self.repository.backend,
            token_cached=token_cached,
            cache_entries=await self.repository.diagnostics(),
            endpoints={
                "catalog": settings.COPERNICUS_CATALOG_URL,
                "process": settings.COPERNICUS_PROCESS_URL,
                "token": settings.COPERNICUS_TOKEN_URL,
            },
        )

    async def get_asset(self, asset_id: str) -> StoredAsset:
        asset = await self.repository.get_asset(asset_id)
        if asset is None:
            raise HTTPException(status_code=404, detail="Satellite asset not found or expired")
        return asset

    async def get_latest_image(self, payload: LatestImageRequest) -> LatestImageResponse:
        response = await self._render_for_request(
            bbox=payload.bbox,
            date_range=payload.date_range,
            collection=payload.collection,
            layer=payload.layer,
            width=payload.width,
            height=payload.height,
            cloud_threshold=payload.cloud_threshold,
            scene_id=None,
        )
        return LatestImageResponse(**response.model_dump())

    async def render_image(self, payload: RenderImageRequest) -> RenderImageResponse:
        return await self._render_for_request(
            bbox=payload.bbox,
            date_range=payload.date_range,
            collection=payload.collection,
            layer=payload.layer,
            width=payload.width,
            height=payload.height,
            cloud_threshold=payload.cloud_threshold,
            scene_id=payload.scene_id,
        )

    async def render_xyz_tile(
        self,
        *,
        z: int,
        x: int,
        y: int,
        date_range: DateRange,
        collection: str,
        layer: SatelliteLayerMode,
        cloud_threshold: int,
    ) -> StoredAsset:
        bbox = self._tile_to_bbox(x=x, y=y, z=z)
        response = await self._render_for_request(
            bbox=bbox,
            date_range=date_range,
            collection=collection,
            layer=layer,
            width=256,
            height=256,
            cloud_threshold=cloud_threshold,
            scene_id=None,
        )
        return await self.get_asset(response.image.asset_id)

    async def _render_for_request(
        self,
        *,
        bbox: BBox,
        date_range: DateRange,
        collection: str,
        layer: SatelliteLayerMode,
        width: int,
        height: int,
        cloud_threshold: int,
        scene_id: str | None,
    ) -> RenderImageResponse:
        self._ensure_configured()
        self._validate_collection(collection)

        search_key = build_search_cache_key(
            bbox=bbox.as_tuple(),
            start_date=date_range.start_date.isoformat(),
            end_date=date_range.end_date.isoformat(),
            collection=collection,
            cloud_threshold=cloud_threshold,
        )

        search_hit = False
        render_hit = False
        asset_hit = False
        token_hit: bool | None = None
        token: AuthTokenRecord | None = None

        cached_scenes = await self.repository.get_search_results(search_key)
        if cached_scenes is None:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                token, token_hit = await self._get_access_token(client)
                search_payload = build_catalog_search_payload(
                    bbox=bbox,
                    date_range=date_range,
                    collection=collection,
                    cloud_threshold=cloud_threshold,
                )
                cached_scenes = await self._fetch_catalog_scenes(client, token, search_payload)
                await self.repository.set_search_results(
                    search_key,
                    cached_scenes,
                    settings.COPERNICUS_SEARCH_CACHE_TTL_SECONDS,
                )
        else:
            search_hit = True

        scene = self._select_scene(cached_scenes, scene_id=scene_id, cloud_threshold=cloud_threshold)

        render_key = build_render_cache_key(
            bbox=bbox.as_tuple(),
            start_date=date_range.start_date.isoformat(),
            end_date=date_range.end_date.isoformat(),
            collection=collection,
            layer=layer.value,
            width=width,
            height=height,
            scene_id=scene.id,
            render_profile=RENDER_PROFILE,
        )

        cached_render = await self.repository.get_render(render_key)
        if cached_render is not None:
            cached_asset = await self.repository.get_asset(cached_render.asset_id)
            if cached_asset is not None:
                render_hit = True
                asset_hit = True
                return RenderImageResponse(
                    bbox=bbox,
                    collection=collection,
                    layer=layer,
                    scene=self._scene_to_response(scene),
                    image=ImageAssetResponse(
                        asset_id=cached_render.asset_id,
                        content_type=cached_render.content_type,
                        size_bytes=cached_render.byte_size,
                        data_url=self._to_data_url(
                            cached_asset.content_type,
                            cached_asset.content,
                        ),
                    ),
                    cache=CacheMetadataResponse(
                        backend=self.repository.backend,
                        search_hit=search_hit,
                        render_hit=render_hit,
                        asset_hit=asset_hit,
                        token_hit=token_hit,
                        search_key=search_key,
                        render_key=render_key,
                    ),
                )

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            if token is None:
                token, token_hit = await self._get_access_token(client)

            process_payload = build_process_payload(
                bbox=bbox,
                date_range=date_range,
                collection=collection,
                layer=layer,
                width=width,
                height=height,
                cloud_threshold=cloud_threshold,
                selected_scene=scene,
            )
            image_bytes, content_type = await self._fetch_rendered_image(client, token, process_payload)

        asset_id = build_asset_id(render_key)
        asset = StoredAsset(
            asset_id=asset_id,
            content_type=content_type,
            content=image_bytes,
            byte_size=len(image_bytes),
            created_at=datetime.now(UTC),
        )
        await self.repository.set_asset(
            asset_id,
            asset,
            settings.COPERNICUS_ASSET_CACHE_TTL_SECONDS,
        )
        await self.repository.set_render(
            render_key,
            RenderCacheRecord(
                asset_id=asset_id,
                content_type=content_type,
                byte_size=len(image_bytes),
                bbox=bbox.as_tuple(),
                collection=collection,
                layer=layer,
                scene=scene,
                created_at=datetime.now(UTC),
            ),
            settings.COPERNICUS_RENDER_CACHE_TTL_SECONDS,
        )

        return RenderImageResponse(
            bbox=bbox,
            collection=collection,
            layer=layer,
            scene=self._scene_to_response(scene),
            image=ImageAssetResponse(
                asset_id=asset_id,
                content_type=content_type,
                size_bytes=len(image_bytes),
                data_url=self._to_data_url(content_type, image_bytes),
            ),
            cache=CacheMetadataResponse(
                backend=self.repository.backend,
                search_hit=search_hit,
                render_hit=render_hit,
                asset_hit=asset_hit,
                token_hit=token_hit,
                search_key=search_key,
                render_key=render_key,
            ),
        )

    def _validate_collection(self, collection: str) -> None:
        if collection not in SUPPORTED_COLLECTIONS:
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported collection '{collection}'. Supported collections: {', '.join(sorted(SUPPORTED_COLLECTIONS))}",
            )

    def _token_cache_key(self) -> str:
        return f"copernicus:{settings.COPERNICUS_CLIENT_ID}:token"

    async def _get_access_token(
        self,
        client: httpx.AsyncClient,
    ) -> tuple[AuthTokenRecord, bool]:
        cached = await self.repository.get_token(self._token_cache_key())
        if cached is not None and not cached.is_expired:
            return cached, True

        try:
            response = await client.post(
                settings.COPERNICUS_TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.COPERNICUS_CLIENT_ID,
                    "client_secret": settings.COPERNICUS_CLIENT_SECRET,
                },
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.exception("Copernicus token request failed with status %s", exc.response.status_code)
            raise HTTPException(status_code=502, detail="Copernicus authentication failed") from exc
        except httpx.HTTPError as exc:
            logger.exception("Copernicus token request failed")
            raise HTTPException(status_code=502, detail="Copernicus authentication failed") from exc

        payload = response.json()
        expires_in = int(payload.get("expires_in", 300))
        ttl_seconds = max(expires_in - settings.COPERNICUS_TOKEN_SAFETY_MARGIN_SECONDS, 60)
        token = AuthTokenRecord(
            access_token=payload["access_token"],
            token_type=payload.get("token_type", "Bearer"),
            expires_at=datetime.now(UTC) + timedelta(seconds=ttl_seconds),
        )
        await self.repository.set_token(self._token_cache_key(), token, ttl_seconds)
        return token, False

    async def _fetch_catalog_scenes(
        self,
        client: httpx.AsyncClient,
        token: AuthTokenRecord,
        payload: dict[str, object],
    ) -> list[SceneRecord]:
        try:
            response = await client.post(
                settings.COPERNICUS_CATALOG_URL,
                json=payload,
                headers=self._auth_headers(token),
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            try:
                error_body = exc.response.text
            except Exception:
                error_body = "<unreadable>"
            logger.error(
                "Copernicus catalog request failed with status %s — body: %s — payload: %s",
                exc.response.status_code,
                error_body,
                payload,
            )
            raise HTTPException(status_code=502, detail="Copernicus catalog lookup failed") from exc
        except httpx.HTTPError as exc:
            logger.exception("Copernicus catalog request failed")
            raise HTTPException(status_code=502, detail="Copernicus catalog lookup failed") from exc

        features = response.json().get("features", [])
        scenes = [self._normalize_scene(feature) for feature in features]
        if not scenes:
            raise HTTPException(status_code=404, detail="No Copernicus scenes found for the selected area and dates")
        return scenes

    async def _fetch_rendered_image(
        self,
        client: httpx.AsyncClient,
        token: AuthTokenRecord,
        payload: dict[str, object],
    ) -> tuple[bytes, str]:
        headers = {
            **self._auth_headers(token),
            "Accept": "image/png",
        }
        try:
            response = await client.post(
                settings.COPERNICUS_PROCESS_URL,
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            try:
                error_body = exc.response.text
            except Exception:
                error_body = "<unreadable>"
            logger.error(
                "Copernicus process request failed with status %s — body: %s — payload keys: %s",
                exc.response.status_code,
                error_body,
                list(payload.keys()),
            )
            raise HTTPException(
                status_code=502,
                detail=f"Copernicus render request failed: {error_body[:300]}",
            ) from exc
        except httpx.HTTPError as exc:
            logger.exception("Copernicus process request failed")
            raise HTTPException(status_code=502, detail="Copernicus render request failed") from exc

        return response.content, response.headers.get("content-type", "image/png")

    def _normalize_scene(self, feature: dict[str, object]) -> SceneRecord:
        properties = feature.get("properties") or {}
        if not isinstance(properties, dict):
            properties = {}

        bbox = feature.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            raise HTTPException(status_code=502, detail="Copernicus catalog returned an invalid bbox")

        acquired_at_raw = properties.get("datetime")
        if not isinstance(acquired_at_raw, str):
            raise HTTPException(status_code=502, detail="Copernicus catalog returned an invalid datetime")

        acquired_at = datetime.fromisoformat(acquired_at_raw.replace("Z", "+00:00"))
        cloud_cover_raw = properties.get("eo:cloud_cover")
        cloud_cover = float(cloud_cover_raw) if isinstance(cloud_cover_raw, (int, float)) else None

        assets = feature.get("assets") or {}
        thumbnail_href = None
        if isinstance(assets, dict):
            thumbnail = assets.get("thumbnail") or {}
            if isinstance(thumbnail, dict):
                thumbnail_href = thumbnail.get("href") if isinstance(thumbnail.get("href"), str) else None

        feature_id = feature.get("id")
        if not isinstance(feature_id, str):
            raise HTTPException(status_code=502, detail="Copernicus catalog returned an invalid scene id")

        return SceneRecord(
            id=feature_id,
            collection=str(feature.get("collection") or settings.COPERNICUS_DEFAULT_COLLECTION),
            bbox=(float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])),
            acquired_at=acquired_at,
            cloud_cover=cloud_cover,
            platform=properties.get("platform") if isinstance(properties.get("platform"), str) else None,
            thumbnail_href=thumbnail_href,
            geometry=feature.get("geometry") if isinstance(feature.get("geometry"), dict) else None,
            properties=properties,
        )

    def _select_scene(
        self,
        scenes: list[SceneRecord],
        *,
        scene_id: str | None,
        cloud_threshold: int,
    ) -> SceneRecord:
        if scene_id is not None:
            for scene in scenes:
                if scene.id == scene_id:
                    return scene
            raise HTTPException(status_code=404, detail="Requested Copernicus scene was not found")

        eligible = [
            scene
            for scene in scenes
            if scene.cloud_cover is None or scene.cloud_cover <= cloud_threshold
        ]
        if not eligible:
            raise HTTPException(status_code=404, detail="No Copernicus scenes matched the cloud threshold")

        return min(
            eligible,
            key=lambda scene: (
                scene.cloud_cover is None,
                scene.cloud_cover if scene.cloud_cover is not None else 101.0,
                -scene.acquired_at.timestamp(),
            ),
        )

    def _scene_to_response(self, scene: SceneRecord) -> SceneMetadataResponse:
        return SceneMetadataResponse(
            id=scene.id,
            collection=scene.collection,
            acquired_at=scene.acquired_at,
            cloud_cover=scene.cloud_cover,
            platform=scene.platform,
            thumbnail_href=scene.thumbnail_href,
            bbox=BBox(
                west=scene.bbox[0],
                south=scene.bbox[1],
                east=scene.bbox[2],
                north=scene.bbox[3],
            ),
        )

    @staticmethod
    def _auth_headers(token: AuthTokenRecord) -> dict[str, str]:
        return {
            "Authorization": f"{token.token_type} {token.access_token}",
        }

    @staticmethod
    def _to_data_url(content_type: str, image_bytes: bytes) -> str:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        return f"data:{content_type};base64,{encoded}"

    @staticmethod
    def _tile_to_bbox(*, x: int, y: int, z: int) -> BBox:
        tiles = 2**z
        west = x / tiles * 360.0 - 180.0
        east = (x + 1) / tiles * 360.0 - 180.0
        north = degrees(atan(sinh(pi * (1 - 2 * y / tiles))))
        south = degrees(atan(sinh(pi * (1 - 2 * (y + 1) / tiles))))
        return BBox(west=west, south=south, east=east, north=north)
