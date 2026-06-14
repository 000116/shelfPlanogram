# Planogram (Gondolbaşı)

```
planogram/
├── backend/          # FastAPI API + Gurobi optimizasyon
│   ├── main.py               # FastAPI uygulaması (uvicorn ile çalışır)
│   ├── auth_users.py         # Kullanıcı hesapları
│   ├── gurobi/               # Planogram servisleri + Gurobi modelleri
│   │   ├── planogram_core.py # Gondol veri hazırlığı ve JSON servisi
│   │   └── planogram_chocolate.py # Çikolata veri/skor ve JSON servisi
│   ├── spa_dist/             # React prod build (FastAPI buradan serve eder)
│   └── data/
│       ├── cikolata.xlsx
│       ├── gondolbasi.xlsx
│       └── planogram.db
├── frontend-react/   # React + TypeScript + Vite ön yüz (TEK ARAYÜZ)
│   ├── public/               # statik varlıklar (shell-logo.png, favicon.svg)
│   └── src/
└── requirements.txt
```

## Ön yüz (React)

Ön yüz `frontend-react/` altında **React + TypeScript (Vite)** ile yazılmıştır.

**Geliştirme (HMR):** FastAPI'yi ve Vite'ı ayrı çalıştır.
```bash
# 1. Backend (FastAPI API) — :8080
cd backend && uvicorn main:app --port 8080 --reload
# 2. Yeni terminalde React dev sunucusu — :5173 (/api otomatik :8080'e proxy)
cd frontend-react && npm install && npm run dev
```
Tarayıcı: http://localhost:5173

**Prod / tek sunucu:** React'i derle, FastAPI hem API'yi hem SPA'yı :8080'den sunar.
```bash
cd frontend-react && npm run build   # → backend/spa_dist
cd ../backend && uvicorn main:app --port 8080
```
Tarayıcı: http://localhost:8080

> Backend **FastAPI** (`backend/main.py`); veri hazırlığı servis modüllerinde,
> matematiksel modeller `backend/gurobi/` altında tutulur.

## Kurulum

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python backend/db_init.py
```

`db_init.py`, Excel kaynaklarını geçici bir SQLite dosyasına aktarır; bütünlük
ve foreign key kontrolleri başarılı olursa `backend/data/planogram.db` dosyasını
atomik olarak yeniler. Aktarım başarısız olursa mevcut veritabanı korunur.

`backend/data/cikolata.xlsx` ve `backend/data/gondolbasi.xlsx` kaynak verileri,
`backend/data/planogram.db` ise uygulamanın kullandığı SQLite veritabanını içerir.

## Gurobi (zorunlu)

Orta ve alt raf **küme sıralaması** `gurobipy` ile MIP optimizasyonu kullanır. Üst raf iş kuralıyla sabittir.

Okuldan lisans aldıktan sonra (macOS):

1. [gurobi.com](https://www.gurobi.com) → Gurobi Optimizer indir ve kur (sürüm 12 önerilir, `requirements.txt` ile uyumlu).
2. Terminalde lisansı aktive et (okulun verdiği yönteme göre), örn.:
   ```bash
   grbgetkey XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   ```
3. Proje sanal ortamında:
   ```bash
   source .venv/bin/activate
   pip install -r requirements.txt
   python -c "import gurobipy as gp; m=gp.Model(); m.optimize(); print('Gurobi OK')"
   ```

`ModuleNotFoundError: gurobipy` → `pip install gurobipy`  
`GurobiError` / lisans hatası → Optimizer kurulumu + `grbgetkey` eksik demektir.

Kısıtlı pip lisansı küçük modellerde çalışabilir; bitirme sunumu için tam akademik lisans tercih edilir.

## Çalıştırma

**Web uygulaması (giriş + panel):**

```bash
cd backend
uvicorn main:app --port 8080
```

Tarayıcı: http://localhost:8080 → giriş ekranı (React SPA)

| Hesap | Kullanıcı adı | Şifre |
|--------|----------------|--------|
| Yönetici | `admin` | `admin123` |
| İstasyon | istasyon adının slug’ı (örn. `acibademistanbul`) | `shell2025` |

- **Yönetici** → `/admin` — tüm istasyonlar, mevcut gondol planogramı
- **İstasyon** → `/app` — sadece kendi istasyonu; kullanıcı adı = istasyon adı (küçük harf, Türkçe karakter yok)

Sol menü: Gondol başı (aktif planogram), Cips, Jelibon (yer tutucu — raf düzeni bitirme projesinden alınmadı).

## API

| Endpoint | Açıklama |
|----------|----------|
| `GET /` | Dashboard (frontend) |
| `GET /api/planogram?roc=6240&quarter=Q1` | Planogram JSON |
| `GET /api/stations` | İstasyon listesi |
