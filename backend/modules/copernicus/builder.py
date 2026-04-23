from __future__ import annotations

from datetime import timedelta
from math import log, pi, radians, tan
from typing import Any

from backend.modules.copernicus.models import SatelliteLayerMode, SceneRecord, SUPPORTED_COLLECTIONS
from backend.modules.copernicus.schemas import BBox, DateRange


WEB_MERCATOR_CRS = "http://www.opengis.net/def/crs/EPSG/0/3857"
WEB_MERCATOR_MAX_LAT = 85.05112878
WEB_MERCATOR_EARTH_RADIUS = 6378137.0


def get_evalscript_for_layer(layer: SatelliteLayerMode) -> str:
    if layer == SatelliteLayerMode.TRUE_COLOR:
        return """
//VERSION=3
function setup() {
  return {
    input: ["B02", "B03", "B04", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02, sample.dataMask];
}
""".strip()

    if layer == SatelliteLayerMode.FALSE_COLOR:
        return """
//VERSION=3
function setup() {
  return {
    input: ["B03", "B04", "B08", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  return [2.4 * sample.B08, 2.2 * sample.B04, 2.0 * sample.B03, sample.dataMask];
}
""".strip()

    if layer == SatelliteLayerMode.NDVI:
        return """
//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  if (sample.dataMask === 0) {
    return [0, 0, 0, 0];
  }

  const ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);

  if (ndvi < 0.0) return [0.35, 0.24, 0.16, 1];
  if (ndvi < 0.2) return [0.74, 0.55, 0.26, 1];
  if (ndvi < 0.4) return [0.84, 0.82, 0.39, 1];
  if (ndvi < 0.6) return [0.55, 0.79, 0.33, 1];
  return [0.16, 0.53, 0.24, 1];
}
""".strip()

    raise ValueError(f"Unsupported layer mode: {layer}")


def build_catalog_search_payload(
    *,
    bbox: BBox,
    date_range: DateRange,
    collection: str,
    cloud_threshold: int,
    limit: int = 25,
) -> dict[str, Any]:
    if collection not in SUPPORTED_COLLECTIONS:
        raise ValueError(f"Unsupported collection: {collection}")

    return {
        "bbox": bbox.as_list(),
        "datetime": date_range.to_catalog_interval(),
        "collections": [collection],
        "limit": limit,
        "filter-lang": "cql2-json",
        "filter": {
            "op": "<=",
            "args": [{"property": "eo:cloud_cover"}, cloud_threshold],
        },
    }


def to_web_mercator_bbox(bbox: BBox) -> list[float]:
    def project(lng: float, lat: float) -> tuple[float, float]:
        clamped_lat = max(-WEB_MERCATOR_MAX_LAT, min(WEB_MERCATOR_MAX_LAT, lat))
        x = WEB_MERCATOR_EARTH_RADIUS * radians(lng)
        y = WEB_MERCATOR_EARTH_RADIUS * log(tan((pi / 4) + (radians(clamped_lat) / 2)))
        return x, y

    west, south = project(bbox.west, bbox.south)
    east, north = project(bbox.east, bbox.north)
    return [west, south, east, north]


MAX_METERS_PER_PIXEL = 1500.0


def _ensure_resolution(bbox: BBox, width: int, height: int) -> tuple[int, int]:
    merc = to_web_mercator_bbox(bbox)
    span_x = abs(merc[2] - merc[0])
    span_y = abs(merc[3] - merc[1])
    min_w = max(256, int(span_x / MAX_METERS_PER_PIXEL) + 1)
    min_h = max(256, int(span_y / MAX_METERS_PER_PIXEL) + 1)
    return max(width, min_w), max(height, min_h)


def build_process_payload(
    *,
    bbox: BBox,
    date_range: DateRange,
    collection: str,
    layer: SatelliteLayerMode,
    width: int,
    height: int,
    cloud_threshold: int,
    selected_scene: SceneRecord | None = None,
) -> dict[str, Any]:
    if collection not in SUPPORTED_COLLECTIONS:
        raise ValueError(f"Unsupported collection: {collection}")

    w, h = _ensure_resolution(bbox, width, height)

    if selected_scene is None:
        time_from = date_range.start_datetime()
        time_to = date_range.end_datetime()
        mosaicking_order = "leastCC"
    else:
        time_from = selected_scene.acquired_at - timedelta(minutes=25)
        time_to = selected_scene.acquired_at + timedelta(minutes=25)
        mosaicking_order = "mostRecent"

    mercator_bbox = to_web_mercator_bbox(bbox)
    mercator_bbox = [round(v, 2) for v in mercator_bbox]

    return {
        "input": {
            "bounds": {
                "bbox": mercator_bbox,
                "properties": {
                    "crs": WEB_MERCATOR_CRS,
                },
            },
            "data": [
                {
                    "type": collection,
                    "dataFilter": {
                        "timeRange": {
                            "from": time_from.strftime("%Y-%m-%dT%H:%M:%SZ"),
                            "to": time_to.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        },
                        "mosaickingOrder": mosaicking_order,
                        "maxCloudCoverage": cloud_threshold,
                    },
                }
            ],
        },
        "output": {
            "width": w,
            "height": h,
            "responses": [
                {
                    "identifier": "default",
                    "format": {"type": "image/png"},
                }
            ],
        },
        "evalscript": get_evalscript_for_layer(layer),
    }
