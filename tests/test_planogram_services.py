import os
import sys
import unittest

from fastapi.testclient import TestClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app  # noqa: E402


class PlanogramServicesTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def login_admin(self):
        response = self.client.post(
            "/api/login",
            json={"username": "admin", "password": "admin123"},
        )
        self.assertEqual(response.status_code, 200)

    def test_unknown_roc_returns_not_found(self):
        self.login_admin()

        response = self.client.get("/api/planogram?roc=999999&quarter=Q1")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "İstasyon bulunamadı")

    def test_missing_roc_uses_default_station_for_admin(self):
        self.login_admin()

        response = self.client.get("/api/planogram?quarter=Q1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["roc"], 2016)

    def test_missing_quarter_defaults_to_q1(self):
        self.login_admin()

        response = self.client.get("/api/planogram?roc=6240")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["quarter"], "Q1")

    def test_planogram_response_contract_contains_kpis_and_shelves(self):
        self.login_admin()

        response = self.client.get("/api/planogram?roc=6240&quarter=Q1")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        for key in (
            "station",
            "roc",
            "quarter_info",
            "total_sales",
            "cat_totals",
            "top_products",
            "ust_shelf",
            "orta_shelf",
            "alt_shelf",
            "gurobi_log",
        ):
            self.assertIn(key, data)
        self.assertGreater(data["total_sales"], 0)
        self.assertGreater(len(data["top_products"]), 0)

    def test_station_user_missing_roc_uses_own_station(self):
        response = self.client.post(
            "/api/login",
            json={"username": "acibademistanbul", "password": "shell2025"},
        )
        self.assertEqual(response.status_code, 200)

        planogram = self.client.get("/api/planogram?quarter=Q1")

        self.assertEqual(planogram.status_code, 200)
        self.assertEqual(planogram.json()["roc"], 6240)

    def test_post_planogram_with_selected_items(self):
        self.login_admin()
        # Fetch GET first to see available items
        response = self.client.get("/api/planogram?roc=6240&quarter=Q1")
        self.assertEqual(response.status_code, 200)
        skus = response.json()["skus"]
        self.assertGreater(len(skus), 0)
        
        # Take a subset of SKUs (first two items)
        selected_names = [skus[0]["name"], skus[1]["name"]]
        
        # Call POST api
        post_response = self.client.post(
            "/api/planogram",
            json={"roc": 6240, "quarter": "Q1", "selected": selected_names}
        )
        self.assertEqual(post_response.status_code, 200)
        res_data = post_response.json()
        
        # Verify selected items status
        for s in res_data["skus"]:
            if s["name"] in selected_names:
                self.assertTrue(s["selected"])
            else:
                self.assertFalse(s["selected"])

    def test_post_planogram_exceeding_capacity_returns_error(self):
        self.login_admin()
        response = self.client.get("/api/planogram?roc=6240&quarter=Q1")
        self.assertEqual(response.status_code, 200)
        skus = response.json()["skus"]
        
        # Select all candidate products to exceed capacity limit
        selected_names = [s["name"] for s in skus]
        
        post_response = self.client.post(
            "/api/planogram",
            json={"roc": 6240, "quarter": "Q1", "selected": selected_names}
        )
        self.assertEqual(post_response.status_code, 500)
        self.assertIn("error", post_response.json())
        self.assertIn("aşmaktadır", post_response.json()["error"])


if __name__ == "__main__":
    unittest.main()
