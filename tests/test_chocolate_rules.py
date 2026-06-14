import os
import sys
import unittest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from gurobi import planogram_chocolate as chocolate
from gurobi.chocolate import target_facing


class ChocolateRulesTest(unittest.TestCase):
    def _catalog_skus(self, data):
        return [
            sku for sku in data["sku3"]
            if not str(data["metrics"][chocolate._norm(sku)]["urun_id"]).startswith("custom_")
        ]

    def test_excel_score_parity(self):
        data = chocolate._load(None, "Q1")
        products = chocolate._build(self._catalog_skus(data), None, None, "Q1")
        self.assertAlmostEqual(
            products["ÜLKER ÇİKOLATALI GOFRET 36 GR"]["score"] * 1000,
            59.1363393455307,
        )
        self.assertAlmostEqual(
            products["DELİ2GO SÜTLÜ ÇİKOLATA"]["score"] * 1000,
            5.0,
        )

    def test_document_facing_thresholds(self):
        self.assertEqual(target_facing(0.061, 1, 4), 4)
        self.assertEqual(target_facing(0.046, 1, 4), 3)
        self.assertEqual(target_facing(0.016, 1, 4), 2)
        self.assertEqual(target_facing(0.004, 1, 4), 1)
        self.assertEqual(target_facing(0.061, 1, 2), 2)

    def test_three_module_package_shelf_and_capacity(self):
        result = chocolate.make_chocolate_planogram("3", roc=6240, quarter="Q1")
        self.assertNotIn("error", result)
        package_cards = []
        for shelf in result["shelves"]:
            self.assertLessEqual(shelf["used_cm"], shelf["cap_cm"])
            if shelf["raf"] == 5:
                package_cards.extend(shelf["cards"])
                self.assertTrue(all(card["locked"] for card in shelf["cards"]))
            else:
                self.assertTrue(all(not card["locked"] for card in shelf["cards"]))
        self.assertEqual(len(package_cards), 17)

    def test_two_module_auto_selects_feasible_subset(self):
        result = chocolate.make_chocolate_planogram("2", roc=6240, quarter="Q1")
        self.assertNotIn("error", result)
        self.assertLess(result["kpis"]["sku_count"], 81)
        for shelf in result["shelves"]:
            self.assertLessEqual(shelf["used_cm"], shelf["cap_cm"])


if __name__ == "__main__":
    unittest.main()
