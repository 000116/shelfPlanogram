import os
import sys
import unittest

from fastapi.testclient import TestClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app  # noqa: E402


class AuthServicesTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_me_returns_unauthorized_before_login(self):
        response = self.client.get("/api/me")

        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.json()["authenticated"])

    def test_me_returns_user_context_after_login(self):
        login = self.client.post(
            "/api/login",
            json={"username": "admin", "password": "admin123"},
        )
        self.assertEqual(login.status_code, 200)

        response = self.client.get("/api/me")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["authenticated"])
        self.assertEqual(data["user"]["username"], "admin")

    def test_logout_clears_session(self):
        self.client.post("/api/login", json={"username": "admin", "password": "admin123"})

        logout = self.client.post("/api/logout")
        me_after_logout = self.client.get("/api/me")

        self.assertEqual(logout.status_code, 200)
        self.assertEqual(logout.json(), {"ok": True})
        self.assertEqual(me_after_logout.status_code, 401)

    def test_stations_requires_login(self):
        response = self.client.get("/api/stations")

        self.assertEqual(response.status_code, 401)

    def test_admin_stations_returns_all_stations(self):
        self.client.post("/api/login", json={"username": "admin", "password": "admin123"})

        response = self.client.get("/api/stations")

        self.assertEqual(response.status_code, 200)
        stations = response.json()
        self.assertEqual(len(stations), 5)
        self.assertIn({"roc": 6240, "name": "Acıbadem İstanbul"}, stations)

    def test_station_stations_returns_only_own_station(self):
        self.client.post(
            "/api/login",
            json={"username": "acibademistanbul", "password": "shell2025"},
        )

        response = self.client.get("/api/stations")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{"roc": 6240, "name": "Acıbadem İstanbul"}])


if __name__ == "__main__":
    unittest.main()
