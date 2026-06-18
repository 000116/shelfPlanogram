import os
import sys
import unittest

from fastapi.testclient import TestClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app  # noqa: E402


class ApiServicesTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def login(self, username="admin", password="admin123"):
        return self.client.post(
            "/api/login",
            json={"username": username, "password": password},
        )

    def test_demo_accounts_are_listed_for_login_screen(self):
        response = self.client.get("/api/demo-accounts")

        self.assertEqual(response.status_code, 200)
        accounts = response.json()
        self.assertGreaterEqual(len(accounts), 1)
        self.assertIn(
            {"role": "Yönetici", "user": "admin", "pass": "admin123", "roc": None},
            accounts,
        )

    def test_admin_login_returns_panel_context(self):
        response = self.login()

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["authenticated"])
        self.assertTrue(data["is_admin"])
        self.assertGreaterEqual(len(data["stations"]), 1)
        self.assertEqual(data["user"]["username"], "admin")

    def test_admin_login_returns_final_chocolate_fixture_labels(self):
        response = self.login()

        self.assertEqual(response.status_code, 200)
        labels = {
            area["id"]: area["label"]
            for area in response.json()["fixture_areas"]
            if area["id"].startswith("CHOCO")
        }
        self.assertEqual(labels["CHOCO3"], "Çikolata Planogram Final · 3 Modül")
        self.assertEqual(labels["CHOCO2"], "Çikolata Planogram Final · 2 Modül")

    def test_wrong_password_is_rejected(self):
        response = self.login(password="yanlis-sifre")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], "Kullanıcı adı veya şifre hatalı")

    def test_planogram_requires_login(self):
        response = self.client.get("/api/planogram?roc=6240&quarter=Q1")

        self.assertEqual(response.status_code, 401)

    def test_admin_can_fetch_station_planogram(self):
        self.assertEqual(self.login().status_code, 200)

        response = self.client.get("/api/planogram?roc=6240&quarter=Q1")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["roc"], 6240)
        self.assertEqual(data["quarter"], "Q1")
        self.assertIn("ust_shelf", data)
        self.assertIn("orta_shelf", data)
        self.assertIn("alt_shelf", data)

    def test_invalid_quarter_returns_bad_request(self):
        self.login()

        response = self.client.get("/api/planogram?roc=6240&quarter=Q5")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "Çeyrek Q1, Q2, Q3 veya Q4 olmalı")

    def test_station_user_can_only_fetch_own_station(self):
        self.assertEqual(self.login("acibademistanbul", "shell2025").status_code, 200)

        own_station = self.client.get("/api/planogram?roc=6240&quarter=Q1")
        other_station = self.client.get("/api/planogram?roc=6198&quarter=Q1")

        self.assertEqual(own_station.status_code, 200)
        self.assertEqual(other_station.status_code, 403)

    def test_chocolate_allocation_stays_within_capacity(self):
        self.login()

        response = self.client.post(
            "/api/chocolate/allocate",
            json={
                "module": "3",
                "selected": [],
                "weights": None,
                "auto": True,
                "roc": 6240,
                "quarter": "Q1",
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["module"], "3")
        self.assertGreater(data["kpis"]["sku_count"], 0)
        for shelf in data["shelves"]:
            self.assertLessEqual(shelf["used_cm"], shelf["cap_cm"])


if __name__ == "__main__":
    unittest.main()
