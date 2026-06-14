# -*- coding: utf-8 -*-
"""
Planogram çekirdek mantığı — çerçeveden bağımsız (Flask/FastAPI fark etmez).
Veri yükleme, Gurobi optimizasyonu ve gondol planogram JSON üretimi burada.
"""
from __future__ import annotations

import os
import gurobipy as gp
from gurobipy import GRB

from auth_users import rebuild_users
from database import DB_PATH, database_signature, db_connection
from .shelf import optimize_shelf as optimize_shelf_model

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

GONDOL_PRODUCT_COUNT = 32  # Gondol başı katalog ürün sayısı (gösterim)

FIXTURE_AREAS = [
    {
        "id": "GONDOL",
        "label": "Gondol başı",
        "priority": True,
        "product_count": GONDOL_PRODUCT_COUNT,
        "shelves": [
            {"id": "ALL", "label": "Tüm raflar"},
            {"id": "UST", "label": "Üst — yoğurt & soğuk içecek"},
            {"id": "ORTA", "label": "Orta — sıcak / tost sandviç"},
            {"id": "ALT", "label": "Alt — soğuk sandviç"},
        ],
    },
    {
        "id": "CHOCO3",
        "label": "Çikolata Planogram Final · 3 Modül",
        "priority": True,
        "kind": "chocolate",
        "module": "3",
        "product_count": 81,
        "shelves": [
            {"id": "ALL", "label": "Tüm raflar"},
            {"id": "R1", "label": "Raf 1 — üst"},
            {"id": "R2", "label": "Raf 2"},
            {"id": "R3", "label": "Raf 3"},
            {"id": "R4", "label": "Raf 4"},
            {"id": "R5", "label": "Raf 5 — alt (kilitli)"},
        ],
    },
    {
        "id": "CHOCO2",
        "label": "Çikolata Planogram Final · 2 Modül",
        "kind": "chocolate",
        "module": "2",
        "product_count": 81,
        "shelves": [
            {"id": "ALL", "label": "Tüm raflar"},
            {"id": "R1", "label": "Raf 1 — üst"},
            {"id": "R2", "label": "Raf 2"},
            {"id": "R3", "label": "Raf 3"},
            {"id": "R4", "label": "Raf 4"},
            {"id": "R5", "label": "Raf 5 — alt"},
        ],
    },
    {
        "id": "CIPS",
        "label": "Cips",
        "priority": False,
        "product_count": 0,
        "shelves": [
            {"id": "ALL", "label": "Tüm raflar"},
        ],
    },
    {
        "id": "JELIBON",
        "label": "Jelibon",
        "priority": False,
        "product_count": 0,
        "shelves": [
            {"id": "ALL", "label": "Tüm raflar"},
        ],
    },
]

# ══════════════════════════════════════════════════════════════════════════════
# BÖLÜM 1 — SABİTLER
# ══════════════════════════════════════════════════════════════════════════════

SHELF_WIDTH_CM = 96.5

QUARTER_MAP = {
    'OCAK': 'Q1', 'ŞUBAT': 'Q1', 'MART': 'Q1',
    'NİSAN': 'Q2', 'MAYIS': 'Q2', 'HAZİRAN': 'Q2', 'HAZİRAN ': 'Q2',
    'TEMMUZ': 'Q3', 'AĞUSTOS': 'Q3', 'EYLÜL': 'Q3',
    'EKİM': 'Q4', 'KASIM': 'Q4', 'ARALIK': 'Q4',
}

QUARTER_INFO = {
    'Q1': {'label': 'Q1 · Kış',       'months': 'Ocak – Mart',    'icon': '❄️',  'season': 'winter'},
    'Q2': {'label': 'Q2 · İlkbahar',  'months': 'Nisan – Haziran','icon': '🌸',  'season': 'spring'},
    'Q3': {'label': 'Q3 · Yaz',       'months': 'Temmuz – Eylül', 'icon': '☀️',  'season': 'summer'},
    'Q4': {'label': 'Q4 · Sonbahar',  'months': 'Ekim – Aralık',  'icon': '🍂',  'season': 'autumn'},
}

# ── Ürün → Küme ───────────────────────────────────────────────────────────────

PRODUCT_CLUSTER = {
    'DELİ2GO ORMAN MEYVELİ YOĞURT':                      'Yogurt',
    'DELİ2GO BALLI & MUZLU YOĞURT':                      'Yogurt',
    'DELİ2GO ORMAN MEYVELİ CHİA PARFE':                  'Yogurt',
    'DELİ2GO SOĞUK SIKIM MEYVE SUYU- YEŞİL DETOKS':      'YeniUrunler',
    'DELİ2GO SOĞUK SIKIM MEYVE SUYU- KIRMIZI GÜÇ':       'YeniUrunler',
    'DELİ2GO SOĞUK SIKIM MEYVE SUYU- SARI FIRTINA':      'YeniUrunler',
    'DELİ2GO ORG. TURUNCU SMOOTHIE 250 ML':              'Smoothie',
    'DELİ2GO ORG. YEŞİL SMOOTHIE 250 ML':               'Smoothie',
    'DELİ2GO ORG. MOR SMOOTHIE 250 ML':                 'Smoothie',
    'DELİ2GO ORG. ÇILEKLI LIMONATA 330 ML':             'Limonata',
    'DELİ2GO ORG. SIYAH ÇAYLI LIMONATA 330 ML':         'Limonata',
    'DELİ2GO ŞEFTALİ SOĞUK ÇAY KUTU 330 ML':           'IceTea',
    'DELİ2GO LİMON SOĞUK ÇAY KUTU 330 ML':             'IceTea',
    'DELİ2GO MANGO-ANANAS SOĞUK ÇAY KUTU 330 ML':       'IceTea',
    'DELİ2GO PORTAKAL&NAR SUYU':                         'MeyveS',
    'DELİ2GO PORTAKAL SUYU':                             'MeyveS',
    'COCA-COLA 330 ML KUTU':                             'Gazli',
    'FANTA 330 ML KUTU':                                 'Gazli',
    'SPRITE 330 ML KUTU':                                'Gazli',
    'DELİ2GO SND SCK MOZARELLA JAMBON BAZLAMA 175G':     'Bazlama',
    'DELİ2GO SND SCK KAVURMALI BAZLAMA 170G':            'Bazlama',
    'DELİ2GO SND SCK KARIŞIK TOST 160G':                'Tost',
    'DELİ2GO SND SCK ÇİFT KAŞARLI TOST 145G':          'Tost',
    'DELI2GO JAMBON MOZARELLA SANDVIC 179 GR':           'Karton',
    'DELI2GO TON BALIKLI SANDVIC 179 GR':                'Karton',
    'DELI2GO HINDI DANA SANDVIC 182 GR':                 'Karton',
    'DELI2GO TAVUK FUMELI PEYNIRLI SANDVIC 177 GR':     'Karton',
    'DELİ2GO KAŞAR SALAM TRİPLE SANDVİÇ 260GR ST17':    'Uclu',
    'DELİ2GO SANDVİÇ UZN HİNDİ FÜME TRIPLE 210GR':     'Uclu',
    'DELI2GO BAGEL / KÖZ BİBERLİ SANDVİÇ':              'Bagel',
    'DELI2GO PLASTIK MOZZARELLA & JAMBON SANDVIC 140 GR':'Plastik',
    'DELI2GO PLASTIK HINDI FUME SANDVIC 140 GR':         'Plastik',
    'DELI2GO PLASTIK TAVUK TERIYAKİ  SANDVIC 140 GR':   'Plastik',
    'DELI2GO PLASTIK KAŞARLI SANDVIC 140 GR':            'Plastik',
    'DELI2GO CIG KOFTE DURUM 180 GR':                    'CigKofte',
}

PRODUCT_LABEL = {
    'DELİ2GO ORMAN MEYVELİ YOĞURT':                      'Orman Mey.',
    'DELİ2GO BALLI & MUZLU YOĞURT':                      'Ballı Muzlu',
    'DELİ2GO ORMAN MEYVELİ CHİA PARFE':                  'Chia Parfe',
    'DELİ2GO SOĞUK SIKIM MEYVE SUYU- YEŞİL DETOKS':      'Yeşil Detoks',
    'DELİ2GO SOĞUK SIKIM MEYVE SUYU- KIRMIZI GÜÇ':       'Kırmızı Güç',
    'DELİ2GO SOĞUK SIKIM MEYVE SUYU- SARI FIRTINA':      'Sarı Fırtına',
    'DELİ2GO ORG. TURUNCU SMOOTHIE 250 ML':              'Turuncu',
    'DELİ2GO ORG. YEŞİL SMOOTHIE 250 ML':               'Yeşil',
    'DELİ2GO ORG. MOR SMOOTHIE 250 ML':                 'Mor',
    'DELİ2GO ORG. ÇILEKLI LIMONATA 330 ML':             'Çilekli Lim.',
    'DELİ2GO ORG. SIYAH ÇAYLI LIMONATA 330 ML':         'Çaylı Lim.',
    'DELİ2GO ŞEFTALİ SOĞUK ÇAY KUTU 330 ML':           'Şeftali IT',
    'DELİ2GO LİMON SOĞUK ÇAY KUTU 330 ML':             'Limon IT',
    'DELİ2GO MANGO-ANANAS SOĞUK ÇAY KUTU 330 ML':       'Mango IT',
    'DELİ2GO PORTAKAL&NAR SUYU':                         'Portakal Nar',
    'DELİ2GO PORTAKAL SUYU':                             'Portakal',
    'COCA-COLA 330 ML KUTU':                             'Cola',
    'FANTA 330 ML KUTU':                                 'Fanta',
    'SPRITE 330 ML KUTU':                                'Sprite',
    'DELİ2GO SND SCK MOZARELLA JAMBON BAZLAMA 175G':     'Moz. Bazlama',
    'DELİ2GO SND SCK KAVURMALI BAZLAMA 170G':            'Kavurma Baz.',
    'DELİ2GO SND SCK KARIŞIK TOST 160G':                'Karışık Tost',
    'DELİ2GO SND SCK ÇİFT KAŞARLI TOST 145G':          'Kaşarlı Tost',
    'DELI2GO JAMBON MOZARELLA SANDVIC 179 GR':           'Jambon Moz.',
    'DELI2GO TON BALIKLI SANDVIC 179 GR':                'Ton Balık',
    'DELI2GO HINDI DANA SANDVIC 182 GR':                 'Hindi Dana',
    'DELI2GO TAVUK FUMELI PEYNIRLI SANDVIC 177 GR':     'Tavuk Füme',
    'DELİ2GO KAŞAR SALAM TRİPLE SANDVİÇ 260GR ST17':    'Kaşar Salam',
    'DELİ2GO SANDVİÇ UZN HİNDİ FÜME TRIPLE 210GR':     'Hindi Füme',
    'DELI2GO BAGEL / KÖZ BİBERLİ SANDVİÇ':              'Bagel',
    'DELI2GO PLASTIK MOZZARELLA & JAMBON SANDVIC 140 GR':'Moz. Jambon',
    'DELI2GO PLASTIK HINDI FUME SANDVIC 140 GR':         'Hindi Füme',
    'DELI2GO PLASTIK TAVUK TERIYAKİ  SANDVIC 140 GR':   'Tavuk Teriy.',
    'DELI2GO PLASTIK KAŞARLI SANDVIC 140 GR':            'Kaşarlı',
    'DELI2GO CIG KOFTE DURUM 180 GR':                    'Çiğ Köfte',
}

# ── Facing Çarpanları (iş kuralı — sabit) ────────────────────────────────────
CLUSTER_MULT = {
    'Yogurt': 1.5, 'YeniUrunler': 1.0, 'Smoothie': 1.0,
    'Limonata': 1.0, 'IceTea': 1.0,
    'Tost': 2.5, 'Bazlama': 2.5, 'Bagel': 1.5, 'Gazli': 1.0,
    'Uclu': 1.5, 'Karton': 1.0, 'Plastik': 1.0, 'CigKofte': 1.0,
}


def shelf_unit(clusters, shelf_width=SHELF_WIDTH_CM):
    total_units = sum(
        CLUSTER_MULT.get(cl, 1.0)
        * len([p for p, c in PRODUCT_CLUSTER.items() if c == cl])
        for cl in clusters
    )
    return shelf_width / max(total_units, 1)


CLUSTER_COLOR = {
    'Yogurt': '#d81b60', 'YeniUrunler': '#2e7d32', 'Smoothie': '#00838f',
    'Limonata': '#006064', 'IceTea': '#004d40', 'MeyveS': '#e65100',
    'Gazli': '#37474f', 'Bazlama': '#f57f17', 'Tost': '#bf360c',
    'Karton': '#1565c0', 'Uclu': '#e64a19', 'Plastik': '#6a1b9a',
    'Bagel': '#4e342e', 'CigKofte': '#33691e',
}

CLUSTER_TO_SHELF = {
    'Yogurt': 'ust', 'YeniUrunler': 'ust', 'Smoothie': 'ust', 'Limonata': 'ust', 'IceTea': 'ust',
    'Tost': 'orta', 'Bazlama': 'orta', 'Bagel': 'orta', 'Gazli': 'orta',
    'Uclu': 'alt', 'Karton': 'alt', 'Plastik': 'alt', 'CigKofte': 'alt'
}

PRODUCT_COLOR = {
    'COCA-COLA 330 ML KUTU':                             '#e53935',
    'FANTA 330 ML KUTU':                                 '#f57c00',
    'SPRITE 330 ML KUTU':                                '#7cb342',
    'DELİ2GO ORG. TURUNCU SMOOTHIE 250 ML':             '#fb8c00',
    'DELİ2GO ORG. YEŞİL SMOOTHIE 250 ML':              '#43a047',
    'DELİ2GO ORG. MOR SMOOTHIE 250 ML':                '#7b1fa2',
    'DELİ2GO SOĞUK SIKIM MEYVE SUYU- YEŞİL DETOKS':    '#388e3c',
    'DELİ2GO SOĞUK SIKIM MEYVE SUYU- KIRMIZI GÜÇ':     '#c62828',
    'DELİ2GO SOĞUK SIKIM MEYVE SUYU- SARI FIRTINA':    '#f9a825',
    'DELİ2GO ŞEFTALİ SOĞUK ÇAY KUTU 330 ML':          '#00897b',
    'DELİ2GO LİMON SOĞUK ÇAY KUTU 330 ML':            '#00695c',
    'DELİ2GO MANGO-ANANAS SOĞUK ÇAY KUTU 330 ML':      '#00796b',
    'DELİ2GO ORG. ÇILEKLI LIMONATA 330 ML':            '#c2185b',
    'DELİ2GO ORG. SIYAH ÇAYLI LIMONATA 330 ML':        '#37474f',
}

CLUSTER_DISPLAY = {
    'Yogurt': 'Yoğurt', 'YeniUrunler': 'Soğuk Sıkım', 'Smoothie': 'Smoothie',
    'Limonata': 'Limonata', 'IceTea': 'Ice Tea', 'MeyveS': 'Meyve Suyu',
    'Gazli': '3rd Party', 'Bazlama': 'Bazlama', 'Tost': 'Tost',
    'Karton': 'Karton', 'Uclu': 'Üçlü', 'Plastik': 'Plastik',
    'Bagel': 'Bagel', 'CigKofte': 'Çiğ Köfte',
}

# ══════════════════════════════════════════════════════════════════════════════
# BÖLÜM 2 — VERİ YÜKLEME
# ══════════════════════════════════════════════════════════════════════════════

CLUSTER_MAPPING = {
    'YOĞURT': 'Yogurt',
    'SOĞUK SIKIM': 'YeniUrunler',
    'SMOOTHIE': 'Smoothie',
    'LİMONATA': 'Limonata',
    'ICE TEA': 'IceTea',
    'TOST': 'Tost',
    'BAZLAMA': 'Bazlama',
    'BAGEL': 'Bagel',
    '3RD PARTY': 'Gazli',
    'ÜÇLÜ': 'Uclu',
    'KARTON': 'Karton',
    'PLASTİK': 'Plastik',
    'ÇİĞ KÖFTE': 'CigKofte'
}

DATA = {}       # Boş bırakıldı (geriye dönük uyumluluk için)
STATIONS = {}   # {roc: name}
_BASE_PRODUCT_CLUSTER = dict(PRODUCT_CLUSTER)
_DATA_SIGNATURE = None


def load_data_from_db():
    global _DATA_SIGNATURE
    signature = database_signature()
    if signature == _DATA_SIGNATURE:
        return

    STATIONS.clear()
    PRODUCT_CLUSTER.clear()
    PRODUCT_CLUSTER.update(_BASE_PRODUCT_CLUSTER)

    if signature is not None:
        with db_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT roc, name FROM stations")
            for roc, name in cursor.fetchall():
                STATIONS[roc] = name

            cursor.execute("SELECT product_name, cluster FROM gondol_products")
            for name, xl_cluster in cursor.fetchall():
                mapped = CLUSTER_MAPPING.get(xl_cluster, xl_cluster)
                PRODUCT_CLUSTER[name] = mapped

    _DATA_SIGNATURE = signature


load_data_from_db()
rebuild_users(STATIONS)
print(f"  ✓ SQLite veritabanı yüklendi — {len(STATIONS)} istasyon ve {len(PRODUCT_CLUSTER)} ürün aktif.")

# ══════════════════════════════════════════════════════════════════════════════
# BÖLÜM 3 — YARDIMCI FONKSİYONLAR
# ══════════════════════════════════════════════════════════════════════════════

def cluster_total(cl, sales):
    return sum(sales.get(p, 0) for p, c in PRODUCT_CLUSTER.items() if c == cl)


def cluster_avg(cl, sales):
    prods = [p for p, c in PRODUCT_CLUSTER.items() if c == cl]
    return sum(sales.get(p, 0) for p in prods) / max(len(prods), 1)


def optimize_shelf(clusters, sales, fixed_left=None, fixed_right=None,
                   left_of=None, fixed_pos=None):
    scores = {c: cluster_total(c, sales) for c in clusters}
    return optimize_shelf_model(
        clusters,
        scores,
        fixed_left=fixed_left,
        fixed_right=fixed_right,
        left_of=left_of,
        fixed_pos=fixed_pos,
    )

# ══════════════════════════════════════════════════════════════════════════════
# BÖLÜM 4 — PLANOGRAM JSON ÜRETİCİ
# ══════════════════════════════════════════════════════════════════════════════

def shelf_unit_for_selected(selected_prods, shelf_width=SHELF_WIDTH_CM):
    total_units = sum(CLUSTER_MULT.get(p['cluster'], 1.0) for p in selected_prods)
    return shelf_width / max(total_units, 1)


def build_cluster_json(cl, selected_products_in_cluster, x_unit):
    prods = [(p['name'], p['sales'], p['width'], p['is_custom']) for p in selected_products_in_cluster]
    prods.sort(key=lambda t: t[1], reverse=True)

    mult = CLUSTER_MULT.get(cl, 1.0)
    prod_w = round(mult * x_unit, 2)

    cards = []
    for name, qty, actual_w, is_custom in prods:
        cards.append({
            'name':     name,
            'label':    PRODUCT_LABEL.get(name, name[:18]),
            'color':    PRODUCT_COLOR.get(name, CLUSTER_COLOR.get(cl, '#607d8b')),
            'sales':    int(qty),
            'mult':     mult,
            'width_cm': prod_w,
            'actual_w': actual_w,
            'is_custom': is_custom,
        })

    return {
        'cluster':      cl,
        'display_name': CLUSTER_DISPLAY.get(cl, cl),
        'color':        CLUSTER_COLOR.get(cl, '#607d8b'),
        'total_sales':  int(sum(qty for _, qty, _, _ in prods)),
        'total_width':  round(prod_w * len(cards), 2),
        'mult':         mult,
        'cards':        cards,
    }


def get_sales_from_db(roc, quarter):
    sales = {}
    if not os.path.exists(DB_PATH):
        return sales
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT product_name, qty
            FROM sales
            WHERE roc = ? AND quarter = ?
        """, (roc, quarter))
        for name, qty in cursor.fetchall():
            sales[name] = qty
    return sales


def make_planogram(roc, quarter, selected=None):
    load_data_from_db()
    sales = get_sales_from_db(roc, quarter)

    # 1. Base candidates from gondol_products table
    candidates = []
    with db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT product_name, cluster, width_cm FROM gondol_products")
        for name, xl_cluster, width in cursor.fetchall():
            mapped_cluster = CLUSTER_MAPPING.get(xl_cluster, xl_cluster)
            sh = CLUSTER_TO_SHELF.get(mapped_cluster)
            if not sh:
                continue
            sales_val = sales.get(name, 0.0)
            w = float(width) if width and float(width) > 0 else 9.0
            candidates.append({
                "name": name,
                "cluster": mapped_cluster,
                "shelf": sh,
                "sales": float(sales_val),
                "width": w,
                "is_custom": False
            })

    # 2. Custom candidates
    try:
        with db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT sku, cluster_key, shelf, width_cm, sales
                FROM custom_products
                WHERE target = 'gondol'
            """)
            for sku, cluster_key, shelf, width, c_sales in cursor.fetchall():
                sh = CLUSTER_TO_SHELF.get(cluster_key) or shelf
                if not sh:
                    continue
                w = float(width) if width and float(width) > 0 else 9.0
                candidates.append({
                    "name": sku,
                    "cluster": cluster_key,
                    "shelf": sh,
                    "sales": float(c_sales or 0.0),
                    "width": w,
                    "is_custom": True
                })
    except Exception:
        pass

    # Deduplicate candidates by name (prefer custom products)
    seen = {}
    for c in candidates:
        name_key = c["name"].strip()
        if name_key not in seen or c["is_custom"]:
            seen[name_key] = c
    candidates = list(seen.values())

    # 3. Gurobi optimization model
    model = gp.Model("gondol_optimization")
    model.Params.OutputFlag = 0

    x = model.addVars(len(candidates), vtype=GRB.BINARY, name="select")

    # Constraint 1: Shelf capacity <= 96.5 cm
    for sh in ['ust', 'orta', 'alt']:
        indices = [i for i, p in enumerate(candidates) if p['shelf'] == sh]
        model.addConstr(
            gp.quicksum(candidates[i]['width'] * x[i] for i in indices) <= 96.5,
            name=f"width_limit_{sh}"
        )

    # Constraint 2: Max 5 products per category (cluster)
    clusters = set(p['cluster'] for p in candidates)
    for cl in clusters:
        indices = [i for i, p in enumerate(candidates) if p['cluster'] == cl]
        model.addConstr(
            gp.quicksum(x[i] for i in indices) <= 5,
            name=f"max_5_{cl}"
        )

    # Constraint 3: Selection constraints (Manual / Auto)
    if selected is not None:
        selected_set = set(selected)
        for i, p in enumerate(candidates):
            if p['name'] in selected_set:
                model.addConstr(x[i] == 1, name=f"force_selected_{i}")
            else:
                model.addConstr(x[i] == 0, name=f"force_deselected_{i}")
    else:
        # Default load / Auto mode: custom products are off by default
        for i, p in enumerate(candidates):
            if p['is_custom']:
                model.addConstr(x[i] == 0, name=f"custom_default_off_{i}")

    # Objective: Maximize sales + tiny bias for selecting products
    model.setObjective(
        gp.quicksum((candidates[i]['sales'] + 0.001) * x[i] for i in range(len(candidates))),
        GRB.MAXIMIZE
    )

    model.optimize()

    if model.Status != GRB.OPTIMAL:
        # Hangi rafın aşıldığını belirleyelim
        for sh in ['ust', 'orta', 'alt']:
            if selected is not None:
                total_w = sum(p['width'] for p in candidates if p['shelf'] == sh and p['name'] in selected_set)
            else:
                total_w = sum(p['width'] for p in candidates if p['shelf'] == sh and p['is_custom'])
            if total_w > 96.5:
                raf_name = "Üst" if sh == "ust" else ("Orta" if sh == "orta" else "Alt")
                raise ValueError(
                    f"Seçtiğiniz ürünlerin toplam genişliği ({total_w:.1f} cm), {raf_name} rafın maksimum genişliğini (96.5 cm) aşmaktadır."
                )
        raise ValueError(
            "Seçilen ürünler raf kapasite ve kategori limitleri (kategori başına en fazla 5 ürün) nedeniyle rafa sığmıyor."
        )

    selected_products = [candidates[i] for i in range(len(candidates)) if x[i].X > 0.5]

    ust_selected = [p for p in selected_products if p['shelf'] == 'ust']
    orta_selected = [p for p in selected_products if p['shelf'] == 'orta']
    alt_selected = [p for p in selected_products if p['shelf'] == 'alt']

    # Recalculate x_unit based on Gurobi selected products
    ust_x = shelf_unit_for_selected(ust_selected)
    orta_x = shelf_unit_for_selected(orta_selected)
    alt_x = shelf_unit_for_selected(alt_selected)

    # Calculate actual physical widths
    ust_physical_width = sum(p['width'] for p in ust_selected)
    orta_physical_width = sum(p['width'] for p in orta_selected)
    alt_physical_width = sum(p['width'] for p in alt_selected)

    # Shelf ordering:
    # 1. Ust shelf is static order of all 5 clusters (reverted to original fixed order)
    ust_order = ['Yogurt', 'YeniUrunler', 'Smoothie', 'Limonata', 'IceTea']

    # 2. Orta shelf ordering optimization (uses all 4 categories):
    # Enforce relative ordering between Tost and Bazlama (whichever has more total sales is on the left)
    tost_total = cluster_total('Tost', sales)
    bazlama_total = cluster_total('Bazlama', sales)
    left_of_constraints = []
    if tost_total >= bazlama_total:
        left_of_constraints.append(('Tost', 'Bazlama'))
    else:
        left_of_constraints.append(('Bazlama', 'Tost'))

    orta_order = optimize_shelf(['Tost', 'Bazlama', 'Bagel', 'Gazli'], sales, fixed_pos={'Gazli': 3}, left_of=left_of_constraints)

    # 3. Alt shelf ordering optimization (uses all 4 categories):
    alt_order = optimize_shelf(['Uclu', 'Karton', 'Plastik', 'CigKofte'], sales, fixed_pos={'Uclu': 0, 'CigKofte': 3})

    # Build the shelf json
    ust_shelf_json = [
        build_cluster_json(c, [p for p in ust_selected if p['cluster'] == c], ust_x)
        for c in ust_order
    ]
    orta_shelf_json = [
        build_cluster_json(c, [p for p in orta_selected if p['cluster'] == c], orta_x)
        for c in orta_order
    ]
    alt_shelf_json = [
        build_cluster_json(c, [p for p in alt_selected if p['cluster'] == c], alt_x)
        for c in alt_order
    ]

    # Recalculate KPI stats
    avg_sm = cluster_avg('Smoothie', sales)
    avg_li = cluster_avg('Limonata', sales)

    hot_winner = orta_order[0] if len(orta_order) > 0 else '—'
    hot_loser = orta_order[1] if len(orta_order) > 1 else (orta_order[0] if len(orta_order) > 0 else '—')
    tost_total = cluster_total('Tost', sales)
    bazlama_total = cluster_total('Bazlama', sales)

    # We only include selected products in top_products and cat_totals:
    selected_sales_map = {p['name']: p['sales'] for p in selected_products}

    top_products = sorted(
        [(PRODUCT_LABEL.get(p['name'], p['name']), int(p['sales'])) for p in selected_products],
        key=lambda x: x[1], reverse=True
    )[:10]

    cat_totals = {'HEALTH': 0, 'NAB': 0, 'SANDWICHES': 0}
    cat_map = {
        'Yogurt': 'HEALTH', 'YeniUrunler': 'HEALTH',
        'Smoothie': 'NAB', 'Limonata': 'NAB', 'IceTea': 'NAB', 'Gazli': 'NAB',
        'Bazlama': 'SANDWICHES', 'Tost': 'SANDWICHES', 'Bagel': 'SANDWICHES',
        'Karton': 'SANDWICHES', 'Uclu': 'SANDWICHES', 'Plastik': 'SANDWICHES',
    }
    for p in selected_products:
        cl = p['cluster']
        cat = cat_map.get(cl)
        if cat:
            cat_totals[cat] += int(p['sales'])

    gurobi_log = {
        'ust': {
            'rule':  'Sabit sıra (iş kuralı)',
            'order': ' → '.join(ust_order),
            'x_cm':  round(ust_x, 2),
            'detail': f"Yogurt=1.5x ({round(1.5*ust_x,1)}cm/ürün)  diğerleri=1.0x ({round(ust_x,1)}cm/ürün)",
        },
        'orta': {
            'rule':   'Gurobi MIP — Gazli=pos3 sabit',
            'order':  ' → '.join(orta_order),
            'winner': hot_winner,
            'x_cm':   round(orta_x, 2),
            'detail': f"Tost/Bazlama=2.5x ({round(2.5*orta_x,1)}cm)  Bagel=1.5x ({round(1.5*orta_x,1)}cm)  Gazli=1.0x ({round(orta_x,1)}cm)",
        },
        'alt': {
            'rule':   'Gurobi MIP — Uclu=pos0, CigKofte=pos3 sabit',
            'order':  ' → '.join(alt_order),
            'x_cm':   round(alt_x, 2),
            'detail': f"Üçlü=1.5x ({round(1.5*alt_x,1)}cm)  Karton/Plastik=1.0x ({round(alt_x,1)}cm)  ÇiğKöfte=1.0x",
        },
        'width_formula': {
            'ust':  f"x={round(ust_x,2)}cm  →  Toplam={round(ust_x*sum(CLUSTER_MULT.get(c,1)*len([p for p in ust_selected if p['cluster']==c]) for c in ust_order),1)}cm",
            'orta': f"x={round(orta_x,2)}cm  →  Toplam={round(orta_x*sum(CLUSTER_MULT.get(c,1)*len([p for p in orta_selected if p['cluster']==c]) for c in orta_order),1)}cm",
            'alt':  f"x={round(alt_x,2)}cm  →  Toplam={round(alt_x*sum(CLUSTER_MULT.get(c,1)*len([p for p in alt_selected if p['cluster']==c]) for c in alt_order),1)}cm",
        },
    }

    skus_list = []
    for p in candidates:
        is_selected = p in selected_products
        brand_display = CLUSTER_DISPLAY.get(p['cluster'], p['cluster'])
        color = CLUSTER_COLOR.get(p['cluster'], '#607d8b')
        skus_list.append({
            "name": p['name'],
            "label": PRODUCT_LABEL.get(p['name'], p['name'][:24]),
            "brand": brand_display,
            "color": color,
            "score": round(p['sales'], 1),
            "locked": p['is_custom'],
            "selected": is_selected,
            "shelf": "Üst Raf" if p['shelf'] == 'ust' else ("Orta Raf" if p['shelf'] == 'orta' else "Alt Raf") if is_selected else None,
            "facing": 1 if is_selected else 0,
            "width_cm": p['width'],
            "is_custom": p['is_custom']
        })
    skus_list.sort(key=lambda x: (x['is_custom'], x['score']), reverse=True)

    return {
        'roc':           roc,
        'station':       STATIONS.get(roc, f'ROC {roc}'),
        'quarter':       quarter,
        'quarter_info':  QUARTER_INFO[quarter],
        'hot_winner':    hot_winner,
        'hot_loser':     hot_loser,
        'tost_total':    int(tost_total),
        'bazlama_total': int(bazlama_total),
        'avg_smoothie':  round(avg_sm, 1),
        'avg_limonata':  round(avg_li, 1),
        'ust_shelf':     ust_shelf_json,
        'orta_shelf':    orta_shelf_json,
        'alt_shelf':     alt_shelf_json,
        'shelf_x':       {'ust': round(ust_x, 2), 'orta': round(orta_x, 2), 'alt': round(alt_x, 2)},
        'shelf_widths': {
            'ust': {
                'used_cm': round(ust_physical_width, 1),
                'max_cm': 96.5,
                'pct': round(ust_physical_width / 96.5 * 100, 1) if ust_physical_width > 0 else 0.0
            },
            'orta': {
                'used_cm': round(orta_physical_width, 1),
                'max_cm': 96.5,
                'pct': round(orta_physical_width / 96.5 * 100, 1) if orta_physical_width > 0 else 0.0
            },
            'alt': {
                'used_cm': round(alt_physical_width, 1),
                'max_cm': 96.5,
                'pct': round(alt_physical_width / 96.5 * 100, 1) if alt_physical_width > 0 else 0.0
            }
        },
        'top_products':  [{'label': l, 'sales': s} for l, s in top_products],
        'cat_totals':    cat_totals,
        'total_sales':   int(sum(selected_sales_map.values())),
        'skus':          skus_list,
        'gurobi_log':    gurobi_log,
    }


# ══════════════════════════════════════════════════════════════════════════════
# BÖLÜM 5 — PANEL CONTEXT (SPA /api/me + /api/login)
# ══════════════════════════════════════════════════════════════════════════════

def panel_context(user: dict | None, is_admin_panel: bool):
    load_data_from_db()
    station_list = [{"roc": roc, "name": name} for roc, name in sorted(STATIONS.items())]
    u = user or {}
    locked_roc = None if is_admin_panel else u.get("roc")
    default_roc = station_list[0]["roc"] if station_list else 6240
    if locked_roc is not None:
        default_roc = locked_roc
    return {
        "stations": station_list,
        "fixture_areas": FIXTURE_AREAS,
        "is_admin": is_admin_panel,
        "user": u,
        "locked_roc": locked_roc,
        "default_roc": default_roc,
        "panel_title": "Yönetici paneli" if is_admin_panel else u.get("display_name", "İstasyon"),
    }
