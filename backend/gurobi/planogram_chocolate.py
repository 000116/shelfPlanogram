# -*- coding: utf-8 -*-
"""Database-backed chocolate planogram service."""

from __future__ import annotations

from database import database_signature, db_connection
from .chocolate import optimize_chocolate_planogram


DEFAULT_WEIGHTS = {
    "satis": 0.22,
    "birim_kar": 0.15,
    "c2": 0.10,
    "ciro_pay": 0.15,
    "niel_gas": 0.20,
    "niel_spm": 0.08,
    "deli2go": 0.10,
}
SCORE_METRICS = ("satis", "birim_kar", "c2", "ciro_pay", "niel_gas", "niel_spm")
QUARTER_COLUMNS = {"Q1": "q1", "Q2": "q2", "Q3": "q3", "Q4": "q4"}

BRAND_COLOR = [
    (("TADELLE",), "#ef6c00", "Tadelle"),
    (("ULKER", "ÜLKER", "ALBENI", "ALBENİ", "DIDO", "DİDO", "COKONAT", "ÇOKONAT",
      "LAVIVA", "LAVİVA", "METRO", "CARAMIO", "COCO STAR", "DOLU DOLU",
      "NAPOLITEN", "NAPOLİTEN"), "#1565c0", "Ülker"),
    (("ETI", "ETİ", "CANGA", "KARAM", "BOL ANTEP", "MAXIMUS", "MAXİMUS", "AHENK"),
     "#e53935", "Eti"),
    (("NESTLE", "KITKAT", "KİTKAT", "DAMAK", "CRUNCH", "CHUNKY"), "#6a1b9a", "Nestlé"),
    (("SNICKERS", "TWIX", "BOUNTY", "MARS"), "#00695c", "Mars"),
    (("KINDER", "BUENO", "FERRERO", "RAFFAELLO", "RAFAELLO", "TOFFIFEE", "NUTELLA",
      "SCHOGETTEN", "MILKA"), "#c2185b", "Kinder/İthal"),
    (("KAHVE DUNYASI", "KAHVE DÜNYASI", "GOFRIK", "GOFRİK", "FRUTIBON", "FRUTİBON",
      "POPCIK", "POPÇİK", "BONTE"), "#6d4c41", "Kahve Dünyası"),
    (("DELI2GO", "DELİ2GO"), "#00838f", "Deli2go"),
    (("CONITTA", "CONİTTA", "FRUX", "SARELLE", "NELLO", "NUTTY MAX", "CAPO NARCISO"),
     "#607d8b", "Diğer"),
]
DEF_COLOR = "#607d8b"

_CACHE = {}
_CACHE_SIGNATURE = None


def _norm(value):
    if value is None:
        return ""
    value = str(value).upper()
    for source, target in (
        ("İ", "I"), ("Ş", "S"), ("Ğ", "G"), ("Ü", "U"),
        ("Ö", "O"), ("Ç", "C"), ("Â", "A"), ("²", "2"),
    ):
        value = value.replace(source, target)
    return " ".join(value.split())


def _brand(name, database_brand=None):
    candidates = [database_brand, name]
    for candidate in candidates:
        normalized = _norm(candidate)
        if not normalized:
            continue
        for keywords, color, label in BRAND_COLOR:
            if any(_norm(keyword) in normalized for keyword in keywords):
                return label, color
    return "Diğer", DEF_COLOR


def _is_new_product(sku, brand, product_type):
    if _norm(product_type) == "YENI":
        return True
    normalized = f"{_norm(brand)} {_norm(sku)}"
    return "DELI2GO" in normalized or "SHELL SELECT" in normalized


def _fetch_custom_chocolate_rows(conn):
    try:
        return conn.execute("""
            SELECT id, target, sku, width_cm, marka, alt_kategori, tahmini_skor, yerlesim, urun_tipi
            FROM custom_products
            WHERE target IN ('choco3', 'choco2')
            ORDER BY id
        """).fetchall()
    except Exception:
        return []


def _dedupe_skus(base_skus, extra_skus):
    seen = set()
    out = []
    for sku in base_skus + extra_skus:
        key = _norm(sku)
        if key in seen:
            continue
        seen.add(key)
        out.append(sku)
    return out


def _merge_custom_chocolate_products(metrics, base_skus, package_skus, custom_rows, new_product_share):
    """Kullanıcının eklediği çikolata ürünlerini optimizasyon listesine dahil et."""
    sku3_extra = []
    sku2_extra = []
    existing = {_norm(sku) for sku in base_skus}

    for row in custom_rows:
        (custom_id, target, sku, width_cm, marka, alt_kategori,
         tahmini_skor, yerlesim, urun_tipi) = row
        sku = str(sku or "").strip()
        if not sku:
            continue
        norm = _norm(sku)
        if norm in existing:
            continue

        score_val = max(float(tahmini_skor or 0), 0.001)
        product_type = urun_tipi or "Mevcut"
        is_new = _is_new_product(sku, marka, product_type)
        is_locked = _norm(yerlesim) == "KILITLI"
        module = "3" if target == "choco3" else "2"

        metrics[norm] = {
            "urun_id": f"custom_{custom_id}",
            "sku": sku,
            "brand": marka or "",
            "sub": alt_kategori or "Çikolata",
            "width_cm": max(float(width_cm or 0), 1.0),
            "product_type": product_type,
            "min_facing": 1,
            "max_facing": 3,
            "current_facing": 0,
            "is_package": is_locked,
            "tahmini_skor": score_val,
            "satis": 0.0,
            "birim_kar": 0.0,
            "c2": 0.0,
            "ciro_pay": 0.0,
            "niel_gas": 0.0,
            "niel_spm": 0.0,
            "deli2go": new_product_share if is_new else 0.0,
        }
        existing.add(norm)
        if module == "3":
            sku3_extra.append(sku)
            if is_locked:
                package_skus.add(sku)
        else:
            sku2_extra.append(sku)

    return sku3_extra, sku2_extra


def clear_cache():
    global _CACHE_SIGNATURE
    _CACHE.clear()
    _CACHE_SIGNATURE = None


def _load(roc=None, quarter="Q1"):
    global _CACHE_SIGNATURE
    quarter = str(quarter).upper()
    if quarter not in QUARTER_COLUMNS:
        raise ValueError("Çeyrek Q1, Q2, Q3 veya Q4 olmalı")

    signature = database_signature()
    if signature != _CACHE_SIGNATURE:
        _CACHE.clear()
        _CACHE_SIGNATURE = signature

    cache_key = (int(roc) if roc is not None else None, quarter)
    if cache_key in _CACHE:
        return _CACHE[cache_key]
    if signature is None:
        return {
            "sku3": [], "sku2": [], "locked": set(), "metrics": {},
            "shelves": {}, "default_weights": dict(DEFAULT_WEIGHTS),
        }

    with db_connection() as conn:
        product_rows = conn.execute("""
            SELECT p.urun_id, p.sku, p.brand, p.sub_category, p.width_cm,
                   p.urun_tipi, p.min_facing, p.max_facing, p.current_facing,
                   p.is_package, m.satis, m.birim_kar, m.c2, m.ciro_pay,
                   m.niel_gas, m.niel_spm, m.deli2go
            FROM chocolate_products p
            JOIN chocolate_metrics m ON m.urun_id = p.urun_id
            ORDER BY p.urun_id
        """).fetchall()

        station_sales = {}
        if roc is not None:
            quarter_column = QUARTER_COLUMNS[quarter]
            station_sales = {
                urun_id: quantity
                for urun_id, quantity in conn.execute(f"""
                    SELECT urun_id, {quarter_column}
                    FROM chocolate_station_sales
                    WHERE roc = ?
                """, (int(roc),)).fetchall()
            }

        shelf_rows = conn.execute("""
            SELECT module, shelf_no, width_cm, multiplier, priority_rank, package_only
            FROM chocolate_shelves
            ORDER BY module, shelf_no
        """).fetchall()
        weight_rows = conn.execute(
            "SELECT metric, weight FROM chocolate_scoring_weights ORDER BY metric"
        ).fetchall()
        custom_rows = _fetch_custom_chocolate_rows(conn)

    metrics = {}
    sku_list = []
    package_skus = set()
    new_product_ids = {
        row[0] for row in product_rows if _is_new_product(row[1], row[2], row[5])
    }
    new_product_share = (
        DEFAULT_WEIGHTS["deli2go"] / len(new_product_ids) if new_product_ids else 0.0
    )
    for row in product_rows:
        (urun_id, sku, brand, sub_category, width_cm, product_type,
         min_facing, max_facing, current_facing, is_package, annual_sales,
         unit_profit, c2, revenue_share, nielsen_gas, nielsen_spm, deli2go) = row
        sku_list.append(sku)
        if is_package:
            package_skus.add(sku)
        metrics[_norm(sku)] = {
            "urun_id": urun_id,
            "sku": sku,
            "brand": brand,
            "sub": sub_category or "Chocolate",
            "width_cm": float(width_cm),
            "product_type": product_type,
            "min_facing": int(min_facing),
            "max_facing": int(max_facing),
            "current_facing": int(current_facing),
            "is_package": bool(is_package),
            "satis": float(station_sales.get(urun_id, annual_sales) or 0),
            "birim_kar": float(unit_profit or 0),
            "c2": float(c2 or 0),
            "ciro_pay": float(revenue_share or 0),
            "niel_gas": float(nielsen_gas or 0),
            "niel_spm": float(nielsen_spm or 0),
            # The document defines this metric as 1/A for every new product.
            "deli2go": new_product_share if urun_id in new_product_ids else 0.0,
        }

    custom_new_ids = {
        row[0] for row in custom_rows
        if _is_new_product(row[2], row[5], row[8])
    }
    custom_new_share = (
        DEFAULT_WEIGHTS["deli2go"] / (len(new_product_ids) + len(custom_new_ids))
        if (new_product_ids or custom_new_ids) else 0.0
    )
    sku3_extra, sku2_extra = _merge_custom_chocolate_products(
        metrics, sku_list, package_skus, custom_rows, custom_new_share,
    )

    shelves = {"2": [], "3": []}
    for module, shelf_no, width_cm, multiplier, priority_rank, package_only in shelf_rows:
        shelves[module].append({
            "shelf_no": int(shelf_no),
            "width_cm": float(width_cm),
            "multiplier": float(multiplier),
            "priority_rank": int(priority_rank),
            "package_only": bool(package_only),
        })

    result = {
        "sku3": _dedupe_skus(sku_list, sku3_extra),
        "sku2": _dedupe_skus(sku_list, sku2_extra),
        "locked": package_skus,
        "metrics": metrics,
        "shelves": shelves,
        "default_weights": dict(weight_rows) or dict(DEFAULT_WEIGHTS),
    }
    _CACHE[cache_key] = result
    return result


def _build(skus, weights=None, roc=None, quarter="Q1"):
    data = _load(roc, quarter)
    metrics = data["metrics"]
    weights = weights or data["default_weights"]
    active = [metrics[_norm(sku)] for sku in skus if _norm(sku) in metrics]
    totals = {
        metric: sum(max(product[metric], 0.0) for product in active) or 1.0
        for metric in SCORE_METRICS
    }

    products = {}
    for sku in skus:
        source = metrics[_norm(sku)]
        if str(source.get("urun_id", "")).startswith("custom_"):
            # Kullanıcı skoru katalogla aynı ölçekte (×1000) — Gurobi raf/sıra kararını buna göre verir.
            score = max(float(source.get("tahmini_skor") or 0), 0.001) / 1000.0
        else:
            score = sum(
                weights[metric] * (max(source[metric], 0.0) / totals[metric])
                for metric in SCORE_METRICS
            )
            score += weights["deli2go"] * max(source["deli2go"], 0.0)
        products[sku] = {
            **source,
            "width": source["width_cm"],
            "score": score,
        }
    return products


def _empty_result(module, roc, quarter, weights, shelves, all_skus, all_products, locked):
    normal_width = next((s["width_cm"] for s in shelves if not s["package_only"]), 0.0)
    shelf_json = [
        {
            "raf": shelf["shelf_no"],
            "mult": shelf["multiplier"],
            "priority_rank": shelf["priority_rank"],
            "package_only": shelf["package_only"],
            "cap_cm": round(shelf["width_cm"], 1),
            "used_cm": 0,
            "used_facing": 0,
            "cards": [],
        }
        for shelf in shelves
    ]
    sku_status = []
    for sku in all_skus:
        product = all_products[sku]
        brand, color = _brand(sku, product["brand"])
        sku_status.append({
            "name": sku,
            "label": sku[:24],
            "brand": brand,
            "color": color,
            "score": round(product["score"] * 1000, 2),
            "locked": module == "3" and product["is_package"],
            "selected": False,
            "shelf": None,
            "facing": 0,
        })
    sku_status.sort(key=lambda item: -item["score"])
    return {
        "module": module,
        "roc": roc,
        "quarter": quarter,
        "title": f"Çikolata Planogram Final ({module} Modül)",
        "shelf_width_cm": normal_width,
        "weights": weights,
        "shelves": shelf_json,
        "kpis": {
            "sku_count": 0, "total_facing": 0, "capacity_fill_pct": 0,
            "locked": len(locked), "total_sales": 0,
        },
        "top": [],
        "skus": sku_status,
    }


def allocate_chocolate_planogram(module, selected, weights=None, auto=False,
                                  sabit_genislik=None, roc=None, quarter="Q1"):
    del sabit_genislik  # Kept only for API backward compatibility.
    module = str(module) if str(module) in ("2", "3") else "3"
    data = _load(roc, quarter)
    all_skus = data["sku3"] if module == "3" else data["sku2"]
    locked = data["locked"] if module == "3" else set()
    shelves = data["shelves"][module]
    weights = weights or data["default_weights"]
    all_products = _build(all_skus, weights, roc, quarter)

    if auto:
        active_skus = list(all_skus)
    else:
        selected_set = set(selected)
        if module == "3" and selected_set:
            selected_set.update(locked)
        active_skus = [sku for sku in all_skus if sku in selected_set]

    if not active_skus:
        return _empty_result(module, roc, quarter, weights, shelves, all_skus, all_products, locked)

    candidates = {}
    for sku in active_skus:
        candidates[sku] = {
            **all_products[sku],
            "required": module == "3" and sku in locked,
        }

    try:
        solution = optimize_chocolate_planogram(candidates, shelves, auto=auto)
    except ValueError as exc:
        return {"error": str(exc)}
    assigned_by_shelf = {shelf["shelf_no"]: [] for shelf in shelves}
    for sku, shelf_no in solution.shelf_by_sku.items():
        assigned_by_shelf[shelf_no].append(sku)

    shelf_json = []
    total_facing = 0
    total_sales = 0
    total_used_cm = 0.0
    total_capacity_cm = sum(shelf["width_cm"] for shelf in shelves)
    shelf_by_no = {shelf["shelf_no"]: shelf for shelf in shelves}

    for shelf_no in sorted(assigned_by_shelf):
        shelf = shelf_by_no[shelf_no]
        items = assigned_by_shelf[shelf_no]
        items.sort(key=lambda sku: -all_products[sku]["score"])
        cards = []
        used_cm = 0.0
        used_facing = 0
        for sku in items:
            product = all_products[sku]
            facing = solution.facing_by_sku[sku]
            brand, color = _brand(sku, product["brand"])
            item_width = facing * product["width"]
            used_cm += item_width
            used_facing += facing
            total_facing += facing
            total_sales += int(product["satis"])
            cards.append({
                "name": sku,
                "label": sku[:24],
                "brand": brand,
                "color": color,
                "facing": facing,
                "score": round(product["score"] * 1000, 2),
                "width_cm": round(product["width"], 1),
                "unit_w": round(item_width, 1),
                "sales": int(product["satis"]),
                "sub": product["sub"],
                "locked": module == "3" and product["is_package"],
            })
        total_used_cm += used_cm
        shelf_json.append({
            "raf": shelf_no,
            "mult": shelf["multiplier"],
            "priority_rank": shelf["priority_rank"],
            "package_only": shelf["package_only"],
            "cap_cm": round(shelf["width_cm"], 1),
            "used_cm": round(used_cm, 1),
            "used_facing": used_facing,
            "cards": cards,
        })

    assigned_skus = set(solution.shelf_by_sku)
    top_items = sorted(assigned_skus, key=lambda sku: -all_products[sku]["score"])[:10]
    sku_status = []
    for sku in all_skus:
        product = all_products[sku]
        brand, color = _brand(sku, product["brand"])
        shelf_no = solution.shelf_by_sku.get(sku)
        sku_status.append({
            "name": sku,
            "label": sku[:24],
            "brand": brand,
            "color": color,
            "score": round(product["score"] * 1000, 2),
            "locked": module == "3" and product["is_package"],
            "selected": sku in assigned_skus,
            "shelf": str(shelf_no) if shelf_no is not None else None,
            "facing": solution.facing_by_sku.get(sku, 0),
        })
    sku_status.sort(key=lambda item: -item["score"])

    normal_width = next(s["width_cm"] for s in shelves if not s["package_only"])
    return {
        "module": module,
        "roc": roc,
        "quarter": quarter,
        "title": f"Çikolata Planogram Final ({module} Modül)",
        "shelf_width_cm": normal_width,
        "weights": weights,
        "shelves": shelf_json,
        "kpis": {
            "sku_count": len(assigned_skus),
            "total_facing": total_facing,
            "total_sales": total_sales,
            "locked": len(locked),
            "capacity_fill_pct": round(total_used_cm / total_capacity_cm * 100, 1),
        },
        "top": [
            {
                "label": sku[:30],
                "score": round(all_products[sku]["score"] * 1000, 2),
                "sales": int(all_products[sku]["satis"]),
            }
            for sku in top_items
        ],
        "skus": sku_status,
    }


def make_chocolate_planogram(module="3", weights=None, roc=None, quarter="Q1"):
    return allocate_chocolate_planogram(
        module=module,
        selected=[],
        weights=weights,
        auto=True,
        roc=roc,
        quarter=quarter,
    )


if __name__ == "__main__":
    for module in ("3", "2"):
        result = make_chocolate_planogram(module)
        print(
            f"{module} Modül: {result['kpis']['sku_count']} SKU, "
            f"{result['kpis']['total_facing']} facing"
        )
