# -*- coding: utf-8 -*-
"""
Planogram — FastAPI backend (Flask'in yerini alır).
Çalıştır:  cd backend && uvicorn main:app --port 8080 --reload
React SPA: ../frontend-react (build → backend/spa_dist)

Aynı /api/* uçları ve aynı JSON formatı korunur → React ön yüzü değişmez.
"""
from __future__ import annotations

import os
import math
import secrets
from typing import Optional, List, Dict

from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field

from gurobi import planogram_core as core
from gurobi.planogram_core import make_planogram, panel_context, STATIONS
from auth_users import authenticate, demo_accounts
from database import db_connection
from gurobi.planogram_chocolate import (
    make_chocolate_planogram, allocate_chocolate_planogram,
    _load, _build, _brand, DEFAULT_WEIGHTS,
)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
SPA_DIST = os.path.join(BACKEND_DIR, "spa_dist")

app = FastAPI(title="Planogram API")
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SECRET_KEY", secrets.token_hex(32)),
    same_site="lax",
    https_only=False,
)


# ── Kimlik doğrulama yardımcıları ───────────────────────────────────────────
def current_user(request: Request):
    return request.session.get("user")


def require_login(request: Request):
    u = request.session.get("user")
    if not u:
        raise HTTPException(status_code=401, detail="Giriş gerekli")
    return u


def require_admin(request: Request):
    u = require_login(request)
    if u.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Yetki yok")
    return u


def is_admin(user: dict | None) -> bool:
    return bool(user and user.get("role") == "admin")


def station_roc_allowed(user: dict | None, roc: int) -> bool:
    if not user:
        return False
    if user.get("role") == "admin":
        return True
    return user.get("roc") == roc


VALID_QUARTERS = {"Q1", "Q2", "Q3", "Q4"}


def resolve_data_context(user: dict, roc: Optional[int], quarter: str) -> tuple[int, str]:
    core.load_data_from_db()
    normalized_quarter = str(quarter).upper()
    if normalized_quarter not in VALID_QUARTERS:
        raise HTTPException(status_code=400, detail="Çeyrek Q1, Q2, Q3 veya Q4 olmalı")

    if roc is None:
        if user.get("roc") is not None:
            resolved_roc = int(user["roc"])
        elif STATIONS:
            resolved_roc = sorted(STATIONS)[0]
        else:
            raise HTTPException(status_code=503, detail="İstasyon verisi bulunamadı")
    else:
        resolved_roc = int(roc)

    if resolved_roc not in STATIONS:
        raise HTTPException(status_code=404, detail="İstasyon bulunamadı")
    if not station_roc_allowed(user, resolved_roc):
        raise HTTPException(status_code=403, detail="Bu istasyona erişim yok")
    return resolved_roc, normalized_quarter


# ══════════════════════════════════════════════════════════════════════════════
# SPA (React) JSON uçları — auth / context
# ══════════════════════════════════════════════════════════════════════════════
class LoginBody(BaseModel):
    username: str = ""
    password: str = ""


@app.get("/api/me")
def api_me(request: Request):
    u = current_user(request)
    if not u:
        return JSONResponse(status_code=401, content={"authenticated": False})
    ctx = panel_context(u, is_admin(u))
    ctx["authenticated"] = True
    return ctx


@app.get("/api/demo-accounts")
def api_demo_accounts():
    return demo_accounts(STATIONS)


@app.post("/api/login")
def api_login(body: LoginBody, request: Request):
    user = authenticate(body.username, body.password)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Kullanıcı adı veya şifre hatalı"})
    request.session["user"] = user
    ctx = panel_context(user, user["role"] == "admin")
    ctx["authenticated"] = True
    return ctx


@app.post("/api/logout")
def api_logout(request: Request):
    request.session.clear()
    return {"ok": True}


@app.get("/api/stations-summary")
def api_stations_summary(user: dict = Depends(require_login)):
    core.load_data_from_db()
    active_zones = [
        {"id": "GONDOL", "label": "Gondol Başı"},
        {"id": "CHOCO3", "label": "Çikolata 3M"},
        {"id": "CHOCO2", "label": "Çikolata 2M"},
    ]
    result = []
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT roc, SUM(qty) FROM sales GROUP BY roc"
        )
        sales_map = {roc: int(total) for roc, total in cursor.fetchall()}

    allowed_rocs = (
        list(core.STATIONS.keys())
        if is_admin(user)
        else ([user["roc"]] if user.get("roc") in core.STATIONS else [])
    )

    for roc in sorted(allowed_rocs):
        name = core.STATIONS.get(roc, f"ROC {roc}")
        result.append({
            "roc": roc,
            "name": name,
            "annual_sales": sales_map.get(roc, 0),
            "active_zones": active_zones,
            "status": "taslak",
        })
    return result


# ══════════════════════════════════════════════════════════════════════════════
# Planogram / Çikolata uçları
# ══════════════════════════════════════════════════════════════════════════════
class GondolAllocateBody(BaseModel):
    roc: Optional[int] = None
    quarter: str = "Q1"
    selected: Optional[List[str]] = None


@app.get("/api/planogram")
def api_planogram(request: Request, roc: Optional[int] = None, quarter: str = "Q1",
                  user: dict = Depends(require_login)):
    roc, quarter = resolve_data_context(user, roc, quarter)
    try:
        return make_planogram(roc, quarter, selected=None)
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/planogram")
def api_planogram_post(body: GondolAllocateBody, user: dict = Depends(require_login)):
    roc, quarter = resolve_data_context(user, body.roc, body.quarter)
    try:
        return make_planogram(roc, quarter, selected=body.selected)
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/chocolate")
def api_chocolate(module: str = "3", roc: Optional[int] = None, quarter: str = "Q1",
                  user: dict = Depends(require_login)):
    roc, quarter = resolve_data_context(user, roc, quarter)
    try:
        if module not in ("3", "2"):
            module = "3"
        return make_chocolate_planogram(module, roc=roc, quarter=quarter)
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.get("/api/chocolate/skus")
def api_chocolate_skus(request: Request, module: str = "3",
                       roc: Optional[int] = None, quarter: str = "Q1",
                       user: dict = Depends(require_login)):
    roc, quarter = resolve_data_context(user, roc, quarter)
    try:
        if module not in ("3", "2"):
            module = "3"
        M = _load(roc, quarter)
        skus = M["sku3"] if module == "3" else M["sku2"]
        locked = M["locked"] if module == "3" else set()

        weights = {}
        for k in DEFAULT_WEIGHTS.keys():
            v = request.query_params.get(k)
            if v is not None:
                try:
                    value = float(v)
                    if math.isfinite(value) and value >= 0:
                        weights[k] = value
                except ValueError:
                    pass
        if (len(weights) != len(DEFAULT_WEIGHTS)
                or abs(sum(weights.values()) - 1.0) > 1e-6):
            weights = DEFAULT_WEIGHTS

        P = _build(skus, weights, roc, quarter)
        out = []
        for s in skus:
            brand, color = _brand(s, P[s].get("brand"))
            out.append({
                "name": s,
                "label": s[:24],
                "brand": brand,
                "color": color,
                "score": round(P[s]["score"] * 1000, 2),
                "locked": (module == "3" and s in locked),
            })
        out.sort(key=lambda x: -x["score"])
        return out
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


class AllocateBody(BaseModel):
    module: str = "3"
    selected: List[str] = Field(default_factory=list)
    weights: Optional[Dict] = None
    auto: bool = False
    sabit_genislik: Optional[float] = None
    roc: Optional[int] = None
    quarter: str = "Q1"


class CustomProductBody(BaseModel):
    target: str
    sku: str
    cluster_key: Optional[str] = None
    display_name: Optional[str] = None
    color: Optional[str] = None
    shelf: Optional[str] = None
    width_cm: float = 0
    sales: Optional[float] = None
    marka: Optional[str] = None
    alt_kategori: Optional[str] = None
    tahmini_skor: Optional[float] = None
    yerlesim: Optional[str] = None
    urun_tipi: Optional[str] = None


def ensure_custom_products_table() -> None:
    with db_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS custom_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target TEXT NOT NULL CHECK (target IN ('gondol', 'choco3', 'choco2')),
                sku TEXT NOT NULL,
                cluster_key TEXT,
                display_name TEXT,
                color TEXT,
                shelf TEXT,
                width_cm REAL NOT NULL DEFAULT 0,
                sales REAL,
                marka TEXT,
                alt_kategori TEXT,
                tahmini_skor REAL,
                yerlesim TEXT,
                urun_tipi TEXT,
                created_by TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


@app.post("/api/chocolate/allocate")
def api_chocolate_allocate(body: AllocateBody, user: dict = Depends(require_login)):
    roc, quarter = resolve_data_context(user, body.roc, body.quarter)
    try:
        module = body.module if body.module in ("3", "2") else "3"
        weights = body.weights or {}
        clean_weights = {}
        for k in DEFAULT_WEIGHTS.keys():
            if k in weights:
                try:
                    value = float(weights[k])
                    if math.isfinite(value) and value >= 0:
                        clean_weights[k] = value
                except (TypeError, ValueError):
                    pass
        if (len(clean_weights) != len(DEFAULT_WEIGHTS)
                or abs(sum(clean_weights.values()) - 1.0) > 1e-6):
            clean_weights = DEFAULT_WEIGHTS
        res = allocate_chocolate_planogram(
            module, body.selected, clean_weights, body.auto, body.sabit_genislik,
            roc=roc, quarter=quarter,
        )
        return res
    except Exception as e:  # noqa: BLE001
        return JSONResponse(status_code=500, content={"error": str(e)})


def custom_product_json(row):
    (product_id, target, sku, cluster_key, display_name, color, shelf, width_cm, sales,
     marka, alt_kategori, tahmini_skor, yerlesim, urun_tipi, created_by, created_at) = row
    return {
        "id": product_id,
        "target": target,
        "sku": sku,
        "cluster_key": cluster_key,
        "display_name": display_name,
        "color": color,
        "shelf": shelf,
        "width_cm": width_cm,
        "sales": sales,
        "marka": marka,
        "alt_kategori": alt_kategori,
        "tahmini_skor": tahmini_skor,
        "yerlesim": yerlesim,
        "urun_tipi": urun_tipi,
        "created_by": created_by,
        "created_at": created_at,
    }


@app.get("/api/custom-products")
def api_custom_products(user: dict = Depends(require_login)):
    del user
    ensure_custom_products_table()
    with db_connection() as conn:
        rows = conn.execute("""
            SELECT id, target, sku, cluster_key, display_name, color, shelf, width_cm, sales,
                   marka, alt_kategori, tahmini_skor, yerlesim, urun_tipi, created_by, created_at
            FROM custom_products
            ORDER BY id
        """).fetchall()
    return [custom_product_json(row) for row in rows]


@app.post("/api/custom-products")
def api_create_custom_product(body: CustomProductBody, user: dict = Depends(require_login)):
    ensure_custom_products_table()
    target = body.target if body.target in ("gondol", "choco3", "choco2") else None
    sku = body.sku.strip()
    if not target or not sku:
        raise HTTPException(status_code=400, detail="Hedef raf ve SKU zorunlu")
    with db_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO custom_products (
                target, sku, cluster_key, display_name, color, shelf, width_cm, sales,
                marka, alt_kategori, tahmini_skor, yerlesim, urun_tipi, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            target, sku, body.cluster_key, body.display_name, body.color, body.shelf,
            float(body.width_cm or 0), body.sales, body.marka, body.alt_kategori,
            body.tahmini_skor, body.yerlesim, body.urun_tipi, user.get("username"),
        ))
        new_id = cursor.lastrowid
        conn.commit()

    if target == 'gondol':
        try:
            roc = user.get("roc") or (sorted(STATIONS)[0] if STATIONS else 6240)
            make_planogram(roc, 'Q1')
        except Exception as e:
            with db_connection() as conn:
                conn.execute("DELETE FROM custom_products WHERE id = ?", (new_id,))
                conn.commit()
            raise HTTPException(status_code=400, detail=str(e))

    with db_connection() as conn:
        row = conn.execute("""
            SELECT id, target, sku, cluster_key, display_name, color, shelf, width_cm, sales,
                   marka, alt_kategori, tahmini_skor, yerlesim, urun_tipi, created_by, created_at
            FROM custom_products
            WHERE id = ?
        """, (new_id,)).fetchone()
    return custom_product_json(row)


@app.delete("/api/custom-products/{product_id}")
def api_delete_custom_product(product_id: int, user: dict = Depends(require_login)):
    del user
    ensure_custom_products_table()
    with db_connection() as conn:
        conn.execute("DELETE FROM custom_products WHERE id = ?", (product_id,))
        conn.commit()
    return {"ok": True}


@app.get("/api/stations")
def api_stations(user: dict = Depends(require_login)):
    if is_admin(user):
        return [{"roc": roc, "name": name} for roc, name in sorted(STATIONS.items())]
    roc = user.get("roc")
    if roc and roc in STATIONS:
        return [{"roc": roc, "name": STATIONS[roc]}]
    return []


# ══════════════════════════════════════════════════════════════════════════════
# SPA serving (React prod build) + statik dosyalar
# ══════════════════════════════════════════════════════════════════════════════
def _spa_index() -> str:
    return os.path.join(SPA_DIST, "index.html")


def serve_spa():
    idx = _spa_index()
    if os.path.isfile(idx):
        return FileResponse(idx)
    return HTMLResponse(
        "<h1>React build bulunamadı</h1>"
        "<p>Geliştirme: <code>cd frontend-react &amp;&amp; npm run dev</code> (http://localhost:5173)</p>"
        "<p>Prod: <code>cd frontend-react &amp;&amp; npm run build</code></p>",
        status_code=200,
    )


if os.path.isdir(os.path.join(SPA_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(SPA_DIST, "assets")), name="assets")


@app.get("/")
def root():
    return serve_spa()


@app.get("/login")
@app.get("/admin")
@app.get("/app")
def spa_pages():
    return serve_spa()


@app.get("/logout")
def logout_redirect(request: Request):
    request.session.clear()
    return RedirectResponse(url="/")


@app.get("/{full_path:path}")
def spa_catch_all(full_path: str):
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"error": "Bulunamadı"})
    # SPA build kökündeki gerçek dosyalar (shell-logo.png, favicon.svg, icons.svg, ...)
    if full_path:
        candidate = os.path.realpath(os.path.join(SPA_DIST, full_path))
        if candidate.startswith(os.path.realpath(SPA_DIST) + os.sep) and os.path.isfile(candidate):
            return FileResponse(candidate)
    return serve_spa()
