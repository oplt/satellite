from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Response

from backend.api.deps.auth import get_current_user
from backend.modules.copernicus.models import SatelliteLayerMode
from backend.modules.copernicus.schemas import (
    DateRange,
    LatestImageRequest,
    LatestImageResponse,
    RenderImageRequest,
    RenderImageResponse,
    SatelliteHealthResponse,
)
from backend.modules.copernicus.service import CopernicusService
from backend.modules.identity_access.models import User


router = APIRouter()
compat_router = APIRouter(include_in_schema=False)


def get_copernicus_service() -> CopernicusService:
    return CopernicusService()


def _with_asset_url[T: LatestImageResponse | RenderImageResponse](response: T) -> T:
    return response.model_copy(
        update={
            "image": response.image.model_copy(
                update={"url": f"/api/satellite/assets/{response.image.asset_id}"}
            )
        }
    )


@router.get("/health", response_model=SatelliteHealthResponse)
async def satellite_health(
    _: User = Depends(get_current_user),
    service: CopernicusService = Depends(get_copernicus_service),
):
    return await service.get_health()


@router.post("/latest-image", response_model=LatestImageResponse)
async def latest_image(
    payload: LatestImageRequest,
    _: User = Depends(get_current_user),
    service: CopernicusService = Depends(get_copernicus_service),
):
    response = await service.get_latest_image(payload)
    return _with_asset_url(response)


@router.post("/render", response_model=RenderImageResponse)
async def render_image(
    payload: RenderImageRequest,
    _: User = Depends(get_current_user),
    service: CopernicusService = Depends(get_copernicus_service),
):
    response = await service.render_image(payload)
    return _with_asset_url(response)


@router.get("/assets/{asset_id}", name="satellite_asset")
async def satellite_asset(
    asset_id: str,
    _: User = Depends(get_current_user),
    service: CopernicusService = Depends(get_copernicus_service),
):
    asset = await service.get_asset(asset_id)
    return Response(
        content=asset.content,
        media_type=asset.content_type,
        headers={"Cache-Control": "private, max-age=1800"},
    )


@router.get("/tiles/{z}/{x}/{y}", name="satellite_tile")
async def satellite_tile(
    z: int,
    x: int,
    y: int,
    start_date: date = Query(...),
    end_date: date = Query(...),
    collection: str = Query("sentinel-2-l2a"),
    layer: SatelliteLayerMode = Query(SatelliteLayerMode.TRUE_COLOR),
    cloud_threshold: int = Query(25, ge=0, le=100),
    _: User = Depends(get_current_user),
    service: CopernicusService = Depends(get_copernicus_service),
):
    asset = await service.render_xyz_tile(
        z=z,
        x=x,
        y=y,
        date_range=DateRange(start_date=start_date, end_date=end_date),
        collection=collection,
        layer=layer,
        cloud_threshold=cloud_threshold,
    )
    return Response(
        content=asset.content,
        media_type=asset.content_type,
        headers={"Cache-Control": "private, max-age=1800"},
    )


compat_router.include_router(router, prefix="/api/satellite")
