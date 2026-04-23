from __future__ import annotations

from datetime import UTC, date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.modules.copernicus.models import SatelliteLayerMode


class BBox(BaseModel):
    west: float = Field(ge=-180, le=180)
    south: float = Field(ge=-90, le=90)
    east: float = Field(ge=-180, le=180)
    north: float = Field(ge=-90, le=90)

    @model_validator(mode="after")
    def validate_bbox(self) -> "BBox":
        if self.west >= self.east:
            raise ValueError("bbox west must be smaller than east")
        if self.south >= self.north:
            raise ValueError("bbox south must be smaller than north")
        return self

    def as_list(self) -> list[float]:
        return [self.west, self.south, self.east, self.north]

    def as_tuple(self) -> tuple[float, float, float, float]:
        return self.west, self.south, self.east, self.north


class DateRange(BaseModel):
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_range(self) -> "DateRange":
        if self.end_date < self.start_date:
            raise ValueError("date_range end_date must be greater than or equal to start_date")
        return self

    def to_catalog_interval(self) -> str:
        return f"{self.start_datetime().isoformat().replace('+00:00', 'Z')}/{self.end_datetime().isoformat().replace('+00:00', 'Z')}"

    def start_datetime(self) -> datetime:
        return datetime.combine(self.start_date, time.min, tzinfo=UTC)

    def end_datetime(self) -> datetime:
        return datetime.combine(self.end_date, time.max, tzinfo=UTC)


class SatelliteRequestBase(BaseModel):
    bbox: BBox
    date_range: DateRange
    collection: str = Field(default="sentinel-2-l2a", min_length=3, max_length=64)
    layer: SatelliteLayerMode = SatelliteLayerMode.TRUE_COLOR
    cloud_threshold: int = Field(default=25, ge=0, le=100)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)


class LatestImageRequest(SatelliteRequestBase):
    pass


class RenderImageRequest(SatelliteRequestBase):
    scene_id: str | None = Field(default=None, min_length=3, max_length=256)


class SceneMetadataResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    collection: str
    acquired_at: datetime
    cloud_cover: float | None = None
    platform: str | None = None
    thumbnail_href: str | None = None
    bbox: BBox


class ImageAssetResponse(BaseModel):
    asset_id: str
    content_type: str
    size_bytes: int
    url: str | None = None
    data_url: str | None = None


class CacheMetadataResponse(BaseModel):
    backend: str = "memory"
    search_hit: bool
    render_hit: bool
    asset_hit: bool
    token_hit: bool | None = None
    search_key: str
    render_key: str


class LatestImageResponse(BaseModel):
    bbox: BBox
    collection: str
    layer: SatelliteLayerMode
    scene: SceneMetadataResponse
    image: ImageAssetResponse
    cache: CacheMetadataResponse


class RenderImageResponse(BaseModel):
    bbox: BBox
    collection: str
    layer: SatelliteLayerMode
    scene: SceneMetadataResponse
    image: ImageAssetResponse
    cache: CacheMetadataResponse


class SatelliteHealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    configured: bool
    default_collection: str
    default_country: str
    cache_backend: str
    token_cached: bool
    cache_entries: dict[str, int]
    endpoints: dict[str, str]
