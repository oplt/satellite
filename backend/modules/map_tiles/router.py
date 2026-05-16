from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from backend.modules.map_tiles.service import MapTileService, map_tile_service

router = APIRouter()


def get_map_tile_service() -> MapTileService:
    return map_tile_service


@router.get("/{provider_name}/{z}/{x}/{y}", name="map_tile")
async def map_tile(
    provider_name: str,
    z: int,
    x: int,
    y: int,
    service: MapTileService = Depends(get_map_tile_service),
):
    tile = await service.get_tile(provider_name=provider_name, z=z, x=x, y=y)
    return Response(
        content=tile.content,
        media_type=tile.content_type,
        headers={"Cache-Control": "public, max-age=604800"},
    )
