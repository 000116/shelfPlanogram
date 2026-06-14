# -*- coding: utf-8 -*-
"""Kullanıcı hesapları — SQLite veritabanı sorguları ve fallback kontrolleri."""

from __future__ import annotations

import os
import re
from typing import Any, Dict, Optional

from database import DB_PATH, db_connection

STATION_PASSWORD = "shell2025"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"
_HASH_METHOD = "pbkdf2:sha256"


def station_username(station_name: str) -> str:
    """Örn. 'Acıbadem İstanbul' → 'acibademistanbul'"""
    s = station_name.lower().strip()
    for a, b in (
        ("ı", "i"), ("ğ", "g"), ("ü", "u"), ("ş", "s"), ("ö", "o"), ("ç", "c"),
        ("İ", "i"), ("Ğ", "g"), ("Ü", "u"), ("Ş", "s"), ("Ö", "o"), ("Ç", "c"),
    ):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]", "", s)


def rebuild_users(stations: Dict[int, str]) -> None:
    # Bu fonksiyon geriye dönük uyumluluk için no-op yapılmıştır çünkü kullanıcılar 
    # veritabanına db_init.py tarafından kaydedilmiştir.
    pass


def authenticate(username: str, password: str) -> Optional[Dict[str, Any]]:
    key = (username or "").strip().lower()
    
    if not os.path.exists(DB_PATH):
        # Veritabanı yoksa eski in-memory fallback mantığını kullanalım
        default_pass = ADMIN_PASSWORD if key == ADMIN_USERNAME else STATION_PASSWORD
        if password == default_pass:
            return {
                "username": key,
                "role": "admin" if key == ADMIN_USERNAME else "station",
                "display_name": "Yönetici" if key == ADMIN_USERNAME else "İstasyon",
                "roc": None if key == ADMIN_USERNAME else 6240,
            }
        return None

    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT username, role, display_name, roc FROM users WHERE username = ?", (key,))
        row = cursor.fetchone()

    if not row:
        return None

    db_username, db_role, db_display_name, db_roc = row

    # Şifre doğrulama (sadece in-memory kontrolü)
    default_pass = ADMIN_PASSWORD if key == ADMIN_USERNAME else STATION_PASSWORD
    if password != default_pass:
        return None

    return {
        "username": key,
        "role": db_role,
        "display_name": db_display_name,
        "roc": db_roc,
    }


def demo_accounts(stations: Dict[int, str]) -> list:
    # Demo hesapları veritabanından çekelim
    rows = []
    if not os.path.exists(DB_PATH):
        return [{"role": "Yönetici", "user": ADMIN_USERNAME, "pass": ADMIN_PASSWORD}]
        
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT username, role, display_name, roc FROM users ORDER BY role ASC, display_name ASC")
        db_users = cursor.fetchall()

    for username, role, display_name, roc in db_users:
        if role == "admin":
            rows.append({
                "role": "Yönetici",
                "user": username,
                "pass": ADMIN_PASSWORD,
                "roc": None
            })
        else:
            rows.append({
                "role": display_name,
                "user": username,
                "pass": STATION_PASSWORD,
                "roc": roc
            })
    return rows
