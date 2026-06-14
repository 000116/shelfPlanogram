// "Ürün Listesi" sayfasındaki Excel kategori adlarını backend'in kullandığı
// küme anahtarlarına eşler (bkz. backend/gurobi/planogram_core.py CLUSTER_MAPPING).
export const CLUSTER_MAPPING: Record<string, string> = {
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
  'ÇİĞ KÖFTE': 'CigKofte',
}

export const CLUSTER_DISPLAY: Record<string, string> = {
  Yogurt: 'Yoğurt',
  YeniUrunler: 'Soğuk Sıkım',
  Smoothie: 'Smoothie',
  Limonata: 'Limonata',
  IceTea: 'Ice Tea',
  MeyveS: 'Meyve Suyu',
  Gazli: '3rd Party',
  Bazlama: 'Bazlama',
  Tost: 'Tost',
  Karton: 'Karton',
  Uclu: 'Üçlü',
  Plastik: 'Plastik',
  Bagel: 'Bagel',
  CigKofte: 'Çiğ Köfte',
}

export const CLUSTER_COLOR: Record<string, string> = {
  Yogurt: '#d81b60',
  YeniUrunler: '#2e7d32',
  Smoothie: '#00838f',
  Limonata: '#006064',
  IceTea: '#004d40',
  MeyveS: '#e65100',
  Gazli: '#37474f',
  Bazlama: '#f57f17',
  Tost: '#bf360c',
  Karton: '#1565c0',
  Uclu: '#e64a19',
  Plastik: '#6a1b9a',
  Bagel: '#4e342e',
  CigKofte: '#33691e',
}

export const CLUSTER_MULT: Record<string, number> = {
  Yogurt: 1.5,
  YeniUrunler: 1.0,
  Smoothie: 1.0,
  Limonata: 1.0,
  IceTea: 1.0,
  Tost: 2.5,
  Bazlama: 2.5,
  Bagel: 1.5,
  Gazli: 1.0,
  Uclu: 1.5,
  Karton: 1.0,
  Plastik: 1.0,
  CigKofte: 1.0,
}

export type ShelfKey = 'ust' | 'orta' | 'alt'

// Backend'de her kümenin sabit olarak ait olduğu raf (bkz. make_planogram).
export const SHELF_OF_CLUSTER: Record<string, ShelfKey> = {
  Yogurt: 'ust', YeniUrunler: 'ust', Smoothie: 'ust', Limonata: 'ust', IceTea: 'ust',
  Tost: 'orta', Bazlama: 'orta', Bagel: 'orta', Gazli: 'orta',
  Uclu: 'alt', Karton: 'alt', Plastik: 'alt', CigKofte: 'alt',
}

export const SHELF_WIDTH_CM = 96.5

export const DEFAULT_COLOR = '#607d8b'

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function shortLabel(name: string): string {
  return name.length > 26 ? name.slice(0, 26) + '…' : name
}

// Bir rafdaki kümelerin toplam genişliğini, küme çarpanı (mult) ve kart sayısına
// göre rafın toplam genişliğine (SHELF_WIDTH_CM) oranlı olarak yeniden hesaplar.
export function recalcWidths<T extends { mult: number; cards: unknown[]; total_width: number }>(clusters: T[]): T[] {
  const totalUnits = clusters.reduce((s, c) => s + c.mult * c.cards.length, 0)
  const xUnit = totalUnits > 0 ? SHELF_WIDTH_CM / totalUnits : 0
  return clusters
    .filter(c => c.cards.length > 0)
    .map(c => ({ ...c, total_width: round2(c.mult * xUnit * c.cards.length) }))
}

// Excel'den (gondolbasi.xlsx → "Ürün Listesi") çıkarılan tekil ürün satırı.
export interface GondolProduct {
  id: number
  name: string
  clusterKey: string
  displayName: string
  color: string
  shelf: ShelfKey
  width_cm: number
  sales?: number
}
