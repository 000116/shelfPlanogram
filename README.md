# Shell Planogram

Shell istasyonları için gondolbaşı ve çikolata raf yerleşimlerini satış verileri,
ürün ölçüleri ve iş kurallarıyla oluşturan web tabanlı planogram uygulaması.
Backend FastAPI ve SQLite, arayüz React + TypeScript, optimizasyon katmanı ise
Gurobi kullanır.

## Özellikler

- İstasyon ve çeyrek bazında gondolbaşı planogramı oluşturma
- Ürün seçimi, otomatik öneri ve raf bazında yerleşim görüntüleme
- 2 ve 3 modüllü çikolata planogramı optimizasyonu
- Satış, kâr, ciro, Nielsen ve Deli2go ağırlıklarını düzenleme
- Yönetici ve istasyon rolleriyle oturum tabanlı erişim
- Gondol veya çikolata raflarına özel ürün ekleme ve silme
- Gondolbaşı ve çikolata Excel dosyalarını tarayıcıda analiz etme
- Planogram görünümünü PNG olarak dışa aktarma
- React SPA'yı FastAPI üzerinden tek sunucuda yayınlama

## Teknolojiler

| Katman | Teknoloji |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8 |
| Backend | Python, FastAPI, Uvicorn |
| Optimizasyon | Gurobi / `gurobipy` |
| Veri | SQLite, OpenPyXL, SheetJS |
| Test | unittest, Vitest, Playwright |

## Proje Yapısı

```text
shellPlanogram/
├── backend/
│   ├── main.py                    # FastAPI uygulaması ve API uçları
│   ├── auth_users.py              # Kullanıcı doğrulama
│   ├── database.py                # SQLite bağlantı yardımcıları
│   ├── db_init.py                 # Excel verilerinden veritabanı üretimi
│   ├── data/                      # Kaynak Excel dosyaları ve yerel SQLite DB
│   ├── gurobi/
│   │   ├── planogram_core.py      # Gondol planogramı
│   │   └── planogram_chocolate.py # Çikolata planogramı
│   └── spa_dist/                  # Üretilen React build'i (Git'e dahil değil)
├── frontend-react/                # React + TypeScript arayüzü
├── tests/                         # Backend ve uçtan uca testler
├── playwright.config.ts
├── requirements.txt
└── package.json
```

## Gereksinimler

- Python 3.10 veya üzeri
- Node.js 20.19 veya üzeri
- npm
- Gurobi Optimizer 12 ve geçerli bir Gurobi lisansı

## Kurulum

Depoyu klonlayın ve proje dizinine girin:

```bash
git clone https://github.com/000116/shelfPlanogram.git
cd shelfPlanogram
git switch feature/initial-project
```

Python ortamını ve backend bağımlılıklarını kurun:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Frontend ve Playwright bağımlılıklarını kurun:

```bash
npm install
cd frontend-react
npm install
cd ..
```

Kaynak Excel dosyalarından yerel SQLite veritabanını oluşturun:

```bash
python backend/db_init.py
```

Bu işlem `backend/data/gondolbasi.xlsx` ve `backend/data/cikolata.xlsx`
dosyalarını okuyarak `backend/data/planogram.db` dosyasını üretir. Veritabanı
ve derleme çıktıları `.gitignore` kapsamındadır.

## Gurobi Lisansı

Gurobi optimizasyonunun çalışması için lisansın makinede etkin olması gerekir.
Akademik lisans anahtarınız varsa örnek aktivasyon komutu:

```bash
grbgetkey XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
```

Kurulumu doğrulayın:

```bash
source .venv/bin/activate
python -c "import gurobipy as gp; m = gp.Model(); m.optimize(); print('Gurobi OK')"
```

`ModuleNotFoundError: gurobipy` hatasında Python bağımlılıklarını yeniden kurun.
Lisans hatasında Gurobi kurulumunu ve lisans aktivasyonunu kontrol edin.

## Geliştirme Ortamı

Backend'i başlatın:

```bash
source .venv/bin/activate
cd backend
uvicorn main:app --port 8080 --reload
```

İkinci terminalde frontend'i başlatın:

```bash
cd frontend-react
npm run dev
```

Uygulama: [http://localhost:5173](http://localhost:5173)

Vite, geliştirme sırasında `/api` isteklerini otomatik olarak
`http://localhost:8080` adresine yönlendirir.

## Üretim Build'i

React uygulamasını derleyin:

```bash
cd frontend-react
npm run build
```

Build çıktısı `backend/spa_dist/` dizinine yazılır. Ardından FastAPI hem API'yi
hem de React SPA'yı aynı porttan sunabilir:

```bash
cd ../backend
uvicorn main:app --host 0.0.0.0 --port 8080
```

Uygulama: [http://localhost:8080](http://localhost:8080)

Üretim ortamında oturum anahtarını mutlaka güçlü ve rastgele bir değerle verin:

```bash
SECRET_KEY="guclu-ve-rastgele-bir-deger" uvicorn main:app --host 0.0.0.0 --port 8080
```

## Demo Hesapları

| Rol | Kullanıcı adı | Şifre |
| --- | --- | --- |
| Yönetici | `admin` | `admin123` |
| İstasyon | İstasyon adının slug hali, ör. `acibademistanbul` | `shell2025` |

Bu bilgiler yalnızca demo/geliştirme kullanımı içindir. İnternete açık gerçek
bir dağıtım öncesinde kimlik doğrulama ve parola yönetimi güçlendirilmelidir.

## Testler

Backend testleri:

```bash
npm run test:backend
```

Frontend birim testleri ve lint:

```bash
cd frontend-react
npm test
npm run lint
```

Playwright uçtan uca testleri:

```bash
npm run test:e2e
```

Playwright yapılandırması backend ve frontend geliştirme sunucularını test
süresince otomatik olarak başlatır.

## API Özeti

Kimlik doğrulama gerektiren uçlar oturum çerezi kullanır.

| Metot | Endpoint | Açıklama |
| --- | --- | --- |
| `GET` | `/api/me` | Aktif kullanıcı ve panel bağlamı |
| `GET` | `/api/demo-accounts` | Demo hesap listesi |
| `POST` | `/api/login` | Oturum açma |
| `POST` | `/api/logout` | Oturumu kapatma |
| `GET` | `/api/stations` | Kullanıcının erişebildiği istasyonlar |
| `GET` | `/api/planogram` | Gondol planogramını oluşturma |
| `POST` | `/api/planogram` | Seçili ürünlerle gondol planogramı oluşturma |
| `GET` | `/api/chocolate` | 2 veya 3 modüllü çikolata planogramı |
| `GET` | `/api/chocolate/skus` | Çikolata SKU ve skor listesi |
| `POST` | `/api/chocolate/allocate` | Ağırlıklarla çikolata yerleşimi oluşturma |
| `GET` | `/api/custom-products` | Özel ürünleri listeleme |
| `POST` | `/api/custom-products` | Özel ürün ekleme |
| `DELETE` | `/api/custom-products/{id}` | Özel ürün silme |

Örnek planogram isteği:

```text
GET /api/planogram?roc=6240&quarter=Q1
```

Geçerli çeyrek değerleri `Q1`, `Q2`, `Q3` ve `Q4`; çikolata modülü değerleri
ise `2` ve `3` şeklindedir.

## Veri Akışı

1. `db_init.py`, Excel kaynaklarını geçici bir SQLite veritabanına aktarır.
2. Bütünlük ve foreign key kontrolleri başarılıysa geçici dosya atomik olarak
   `planogram.db` dosyasının yerine alınır.
3. FastAPI, istasyon ve ürün verilerini SQLite üzerinden yükler.
4. Gurobi modelleri seçilen istasyon, çeyrek, SKU ve ağırlıklara göre yerleşimi
   hesaplar.
5. React arayüzü sonuçları raf planogramı olarak gösterir.

## Lisans

Bu depoda henüz bir lisans dosyası bulunmamaktadır. Kullanım ve dağıtım
koşulları proje sahibi tarafından belirlenmelidir.
