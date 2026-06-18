import os
import sqlite3
import sys
import unittest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database import DB_PATH  # noqa: E402


class DatabaseIntegrityTest(unittest.TestCase):
    def setUp(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.execute("PRAGMA foreign_keys = ON")

    def tearDown(self):
        self.conn.close()

    def scalar(self, query: str, params: tuple = ()):
        return self.conn.execute(query, params).fetchone()[0]

    def test_required_tables_have_data(self):
        expected_min_counts = {
            "stations": 5,
            "users": 6,
            "gondol_products": 30,
            "sales": 600,
            "chocolate_products": 80,
            "chocolate_metrics": 80,
            "chocolate_station_sales": 400,
            "chocolate_shelves": 10,
            "chocolate_scoring_weights": 7,
        }

        for table, minimum in expected_min_counts.items():
            with self.subTest(table=table):
                self.assertGreaterEqual(self.scalar(f"SELECT COUNT(*) FROM {table}"), minimum)

    def test_admin_and_station_users_exist(self):
        admin_count = self.scalar("SELECT COUNT(*) FROM users WHERE username = 'admin' AND role = 'admin'")
        station_count = self.scalar("SELECT COUNT(*) FROM users WHERE role = 'station' AND roc IS NOT NULL")

        self.assertEqual(admin_count, 1)
        self.assertEqual(station_count, 5)

    def test_station_users_reference_existing_stations(self):
        missing = self.scalar(
            """
            SELECT COUNT(*)
            FROM users u
            LEFT JOIN stations s ON s.roc = u.roc
            WHERE u.role = 'station' AND s.roc IS NULL
            """
        )

        self.assertEqual(missing, 0)

    def test_chocolate_weights_sum_to_one(self):
        total = self.scalar("SELECT SUM(weight) FROM chocolate_scoring_weights")

        self.assertAlmostEqual(total, 1.0)

    def test_sqlite_foreign_key_check_is_clean(self):
        problems = self.conn.execute("PRAGMA foreign_key_check").fetchall()

        self.assertEqual(problems, [])


if __name__ == "__main__":
    unittest.main()
