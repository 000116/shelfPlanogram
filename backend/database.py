# -*- coding: utf-8 -*-
"""SQLite connection and database change helpers."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from typing import Iterator


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BACKEND_DIR, "data", "planogram.db")


def connect_db(path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def db_connection(path: str = DB_PATH) -> Iterator[sqlite3.Connection]:
    conn = connect_db(path)
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def database_signature(path: str = DB_PATH) -> tuple[int, int] | None:
    try:
        stat = os.stat(path)
    except FileNotFoundError:
        return None
    return stat.st_mtime_ns, stat.st_size
