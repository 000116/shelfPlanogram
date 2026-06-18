import os
import sys
import unittest

from fastapi.testclient import TestClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app  # noqa: E402


class ChocolateApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def login_admin(self):
        response = self.client.post(
            "/api/login",
            json={"username": "admin", "password": "admin123"},
        )
        self.assertEqual(response.status_code, 200)

    def allocate(self, module="3", auto=True, selected=None, weights=None, roc=6240):
        return self.client.post(
            "/api/chocolate/allocate",
            json={
                "module": module,
                "selected": selected or [],
                "weights": weights,
                "auto": auto,
                "roc": roc,
                "quarter": "Q1",
            },
        )

    def test_chocolate_endpoint_requires_login(self):
        response = self.client.get("/api/chocolate?module=3&roc=6240&quarter=Q1")

        self.assertEqual(response.status_code, 401)

    def test_chocolate_skus_returns_ranked_products(self):
        self.login_admin()

        response = self.client.get("/api/chocolate/skus?module=3&roc=6240&quarter=Q1")

        self.assertEqual(response.status_code, 200)
        skus = response.json()
        self.assertGreaterEqual(len(skus), 81)
        first = skus[0]
        for key in ("name", "label", "brand", "color", "score", "locked"):
            self.assertIn(key, first)
        self.assertGreaterEqual(first["score"], skus[-1]["score"])

    def test_chocolate_module_falls_back_to_three_module(self):
        self.login_admin()

        response = self.client.get("/api/chocolate?module=unknown&roc=6240&quarter=Q1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["module"], "3")

    def test_allocate_invalid_module_falls_back_to_three_module(self):
        self.login_admin()

        response = self.allocate(module="invalid", auto=True)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["module"], "3")

    def test_allocate_invalid_weights_falls_back_to_default_weights(self):
        self.login_admin()

        response = self.allocate(
            module="3",
            auto=True,
            weights={"satis": 0.9, "birim_kar": 0.9},
        )

        self.assertEqual(response.status_code, 200)
        weights = response.json()["weights"]
        self.assertAlmostEqual(sum(weights.values()), 1.0)
        self.assertEqual(weights["satis"], 0.22)

    def test_station_user_cannot_allocate_other_station_chocolate(self):
        login = self.client.post(
            "/api/login",
            json={"username": "acibademistanbul", "password": "shell2025"},
        )
        self.assertEqual(login.status_code, 200)

        response = self.allocate(module="3", auto=True, roc=6198)

        self.assertEqual(response.status_code, 403)

    def test_manual_clear_returns_empty_planogram_with_sku_list(self):
        self.login_admin()

        response = self.allocate(module="3", auto=False, selected=[])

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertNotIn("error", data)
        self.assertEqual(data["kpis"]["sku_count"], 0)
        self.assertEqual(sum(1 for sku in data["skus"] if sku.get("selected")), 0)
        self.assertGreaterEqual(len(data["skus"]), 81)
        self.assertEqual(len(data["shelves"]), 5)

    def test_auto_recommendation_after_clear_selects_feasible_subset(self):
        self.login_admin()

        response = self.allocate(module="3", auto=True, selected=[])

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertNotIn("error", data)
        self.assertGreater(data["kpis"]["sku_count"], 0)
        for shelf in data["shelves"]:
            self.assertLessEqual(shelf["used_cm"], shelf["cap_cm"])

    def test_locked_products_remain_on_bottom_shelf_in_three_module(self):
        self.login_admin()

        response = self.allocate(module="3", auto=True, selected=[])

        self.assertEqual(response.status_code, 200)
        data = response.json()
        locked_cards = []
        for shelf in data["shelves"]:
            for card in shelf["cards"]:
                if card["locked"]:
                    locked_cards.append(card)
                    self.assertEqual(shelf["raf"], 5)
            if shelf["raf"] == 5:
                self.assertTrue(all(card["locked"] for card in shelf["cards"]))
        self.assertEqual(len(locked_cards), data["kpis"]["locked"])


if __name__ == "__main__":
    unittest.main()
