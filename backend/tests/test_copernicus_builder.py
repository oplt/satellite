import unittest

from backend.modules.copernicus.builder import WEB_MERCATOR_CRS, build_process_payload
from backend.modules.copernicus.models import SatelliteLayerMode
from backend.modules.copernicus.repository import build_render_cache_key
from backend.modules.copernicus.schemas import BBox, DateRange


class CopernicusBuilderTest(unittest.TestCase):
    def test_process_payload_uses_web_mercator_bounds(self):
        payload = build_process_payload(
            bbox=BBox(west=2.5136, south=49.4969, east=6.4079, north=51.5053),
            date_range=DateRange(start_date="2026-03-15", end_date="2026-04-05"),
            collection="sentinel-2-l2a",
            layer=SatelliteLayerMode.TRUE_COLOR,
            width=1024,
            height=768,
            cloud_threshold=25,
        )

        bounds = payload["input"]["bounds"]
        self.assertEqual(bounds["properties"]["crs"], WEB_MERCATOR_CRS)
        self.assertLess(bounds["bbox"][0], bounds["bbox"][2])
        self.assertLess(bounds["bbox"][1], bounds["bbox"][3])
        self.assertGreater(abs(bounds["bbox"][0]), 100000)
        self.assertGreater(abs(bounds["bbox"][1]), 100000)

    def test_render_cache_key_changes_with_render_profile(self):
        key_v1 = build_render_cache_key(
            bbox=(2.5136, 49.4969, 6.4079, 51.5053),
            start_date="2026-03-15",
            end_date="2026-04-05",
            collection="sentinel-2-l2a",
            layer="true_color",
            width=736,
            height=1060,
            scene_id="scene-1",
            render_profile="v1",
        )
        key_v2 = build_render_cache_key(
            bbox=(2.5136, 49.4969, 6.4079, 51.5053),
            start_date="2026-03-15",
            end_date="2026-04-05",
            collection="sentinel-2-l2a",
            layer="true_color",
            width=736,
            height=1060,
            scene_id="scene-1",
            render_profile="mercator-v1",
        )

        self.assertNotEqual(key_v1, key_v2)
