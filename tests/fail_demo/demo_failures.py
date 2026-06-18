# -*- coding: utf-8 -*-
"""
Bilerek başarısız 3 demo test — hocaya kırmızı/yeşil çıktı göstermek için.

Normal test koşumuna DAHİL DEĞİL. Sadece:
  npm run test:fail-demo
"""
import os
import sys
import unittest

from fastapi.testclient import TestClient

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app  # noqa: E402


class IntentionalFailureDemoTest(unittest.TestCase):
    """Gerçek sistem doğru çalışır; beklentiler bilerek yanlış yazılmıştır."""

    def setUp(self):
        self.client = TestClient(app)

    def test_demo_1_wrong_password_should_not_login(self):
        """Demo: Yanlış şifre — backend 401 döner, test bilerek 200 bekler."""
        response = self.client.post(
            "/api/login",
            json={"username": "admin", "password": "yanlis-sifre"},
        )
        self.assertEqual(response.status_code, 200)

    def test_demo_2_planogram_should_not_be_public_without_login(self):
        """Demo: Oturumsuz planogram — backend 401 döner, test bilerek 200 bekler."""
        response = self.client.get("/api/planogram?roc=6240&quarter=Q1")
        self.assertEqual(response.status_code, 200)

    def test_demo_3_chocolate_fixture_label_demo_failure(self):
        """Demo: Çikolata etiketi — gerçekte 'Final' içerir, test bilerek eski etiketi arar."""
        login = self.client.post(
            "/api/login",
            json={"username": "admin", "password": "admin123"},
        )
        self.assertEqual(login.status_code, 200)
        labels = [
            area["label"]
            for area in login.json()["fixture_areas"]
            if area["id"] == "CHOCO3"
        ]
        self.assertEqual(labels, ["Çikolata · 3 Modül"])


if __name__ == "__main__":
    unittest.main()
