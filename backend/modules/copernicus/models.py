from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any


class SatelliteLayerMode(str, Enum):
    TRUE_COLOR = "true_color"
    FALSE_COLOR = "false_color"
    NDVI = "ndvi"


SUPPORTED_COLLECTIONS = frozenset({"sentinel-2-l2a"})


@dataclass(slots=True)
class AuthTokenRecord:
    access_token: str
    token_type: str
    expires_at: datetime

    @property
    def is_expired(self) -> bool:
        return datetime.now(UTC) >= self.expires_at


@dataclass(slots=True)
class SceneRecord:
    id: str
    collection: str
    bbox: tuple[float, float, float, float]
    acquired_at: datetime
    cloud_cover: float | None
    platform: str | None = None
    thumbnail_href: str | None = None
    geometry: dict[str, Any] | None = None
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class StoredAsset:
    asset_id: str
    content_type: str
    content: bytes
    byte_size: int
    created_at: datetime


@dataclass(slots=True)
class RenderCacheRecord:
    asset_id: str
    content_type: str
    byte_size: int
    bbox: tuple[float, float, float, float]
    collection: str
    layer: SatelliteLayerMode
    scene: SceneRecord
    created_at: datetime

