import os
import sys
import unittest

from fastapi.testclient import TestClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database import db_connection  # noqa: E402
from main import app, ensure_custom_products_table  # noqa: E402


class CustomProductsApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.created_ids = []
        ensure_custom_products_table()

    def tearDown(self):
        if not self.created_ids:
            return
        with db_connection() as conn:
            conn.executemany(
                "DELETE FROM custom_products WHERE id = ?",
                [(product_id,) for product_id in self.created_ids],
            )
            conn.commit()

    def login_admin(self):
        response = self.client.post(
            "/api/login",
            json={"username": "admin", "password": "admin123"},
        )
        self.assertEqual(response.status_code, 200)

    def test_custom_products_require_login(self):
        response = self.client.get("/api/custom-products")

        self.assertEqual(response.status_code, 401)

    def test_create_list_and_delete_chocolate_custom_product(self):
        self.login_admin()

        create = self.client.post(
            "/api/custom-products",
            json={
                "target": "choco3",
                "sku": "UNIT TEST SKU",
                "width_cm": 4.2,
                "marka": "Test Marka",
                "alt_kategori": "Tablet",
                "tahmini_skor": 42,
                "yerlesim": "Raf 1",
                "urun_tipi": "Yeni",
            },
        )

        self.assertEqual(create.status_code, 200)
        created = create.json()
        self.created_ids.append(created["id"])
        self.assertEqual(created["target"], "choco3")
        self.assertEqual(created["sku"], "UNIT TEST SKU")
        self.assertEqual(created["marka"], "Test Marka")

        listed = self.client.get("/api/custom-products")
        self.assertEqual(listed.status_code, 200)
        self.assertTrue(any(item["id"] == created["id"] for item in listed.json()))

        deleted = self.client.delete(f"/api/custom-products/{created['id']}")
        self.assertEqual(deleted.status_code, 200)
        self.created_ids.remove(created["id"])

        listed_after_delete = self.client.get("/api/custom-products")
        self.assertFalse(any(item["id"] == created["id"] for item in listed_after_delete.json()))

    def test_custom_chocolate_product_appears_in_skus_and_allocate(self):
        self.login_admin()
        sku = "E2E CUSTOM CHOCOLATE SKU"

        create = self.client.post(
            "/api/custom-products",
            json={
                "target": "choco3",
                "sku": sku,
                "width_cm": 4.0,
                "marka": "Test Marka",
                "alt_kategori": "Tablet",
                "tahmini_skor": 55,
                "yerlesim": "Serbest",
                "urun_tipi": "Yeni",
            },
        )
        self.assertEqual(create.status_code, 200)
        self.created_ids.append(create.json()["id"])

        skus = self.client.get("/api/chocolate/skus?module=3&roc=6240&quarter=Q1")
        self.assertEqual(skus.status_code, 200)
        names = [item["name"] for item in skus.json()]
        self.assertIn(sku, names)

        allocate = self.client.post(
            "/api/chocolate/allocate",
            json={
                "module": "3",
                "selected": [sku],
                "auto": False,
                "roc": 6240,
                "quarter": "Q1",
            },
        )
        self.assertEqual(allocate.status_code, 200)
        data = allocate.json()
        self.assertNotIn("error", data)
        assigned = {item["name"] for item in data["skus"] if item["selected"]}
        self.assertIn(sku, assigned)
        shelf_cards = [
            card["name"]
            for shelf in data["shelves"]
            for card in shelf["cards"]
        ]
        self.assertIn(sku, shelf_cards)

    def test_invalid_custom_product_target_is_rejected(self):
        self.login_admin()

        response = self.client.post(
            "/api/custom-products",
            json={"target": "bad-target", "sku": "BAD", "width_cm": 1},
        )

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
