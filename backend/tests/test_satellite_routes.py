import unittest

from backend.api.main import app


class SatelliteRouteRegistrationTest(unittest.TestCase):
    def test_latest_image_routes_are_registered_for_v1_and_compat_paths(self):
        route_methods = {
            route.path: frozenset(route.methods or set())
            for route in app.routes
            if getattr(route, "path", None)
        }

        self.assertEqual(route_methods.get("/api/v1/satellite/latest-image"), frozenset({"POST"}))
        self.assertEqual(route_methods.get("/api/satellite/latest-image"), frozenset({"POST"}))
