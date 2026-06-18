export interface Station { roc: number; name: string; }

export interface FixtureShelf { id: string; label: string; }
export interface FixtureArea {
  id: string;
  label: string;
  priority?: boolean;
  kind?: string;
  module?: string;
  product_count: number;
  shelves: FixtureShelf[];
}

export interface User {
  username?: string;
  role?: string;
  display_name?: string;
  roc?: number | null;
}

export interface MeContext {
  authenticated: boolean;
  is_admin: boolean;
  user: User;
  stations: Station[];
  fixture_areas: FixtureArea[];
  locked_roc: number | null;
  default_roc: number;
  panel_title: string;
}

export interface DemoAccount { role: string; user: string; pass: string; roc?: number; }

/* ─── Gondol planogram ─────────────────────────────────────────────── */
export interface GondolCard { name: string; label: string; color: string; sales: number; is_custom?: boolean; actual_w?: number; }
export interface GondolCluster {
  cluster: string;
  display_name: string;
  color: string;
  total_width: number;
  total_sales: number;
  mult: number;
  cards: GondolCard[];
}
export interface GurobiShelfLog {
  rule: string;
  order: string;
  winner?: string;
  x_cm: number;
  detail: string;
}
export interface GurobiLog {
  ust: GurobiShelfLog;
  orta: GurobiShelfLog;
  alt: GurobiShelfLog;
  width_formula: { ust: string; orta: string; alt: string };
}

export interface PlanogramData {
  station: string;
  roc: number;
  quarter_info: { label: string; months: string };
  total_sales: number;
  cat_totals: { HEALTH: number; NAB: number; SANDWICHES: number };
  top_products: { label: string; sales: number }[];
  ust_shelf: GondolCluster[];
  orta_shelf: GondolCluster[];
  alt_shelf: GondolCluster[];
  hot_winner: string;
  hot_loser: string;
  tost_total: number;
  bazlama_total: number;
  avg_smoothie: number;
  avg_limonata: number;
  shelf_x: { ust: number; orta: number; alt: number };
  shelf_widths?: {
    ust: { used_cm: number; max_cm: number; pct: number };
    orta: { used_cm: number; max_cm: number; pct: number };
    alt: { used_cm: number; max_cm: number; pct: number };
  };
  skus?: ChocoSku[];
  gurobi_log: GurobiLog;
  error?: string;
}

/* ─── Çikolata ─────────────────────────────────────────────────────── */
export interface ChocoCard {
  name: string; label: string; brand: string; color: string;
  facing: number; score: number; width_cm: number; unit_w: number;
  sales: number; sub: string; locked: boolean;
}
export interface ChocoShelf {
  raf: number; mult: number; cap_cm: number; cap_facing?: number;
  priority_rank?: number; package_only?: boolean;
  used_cm: number; used_facing?: number; cards: ChocoCard[];
}
export interface ChocoSku {
  name: string; label: string; brand: string; color: string;
  score: number; locked: boolean; selected?: boolean;
  shelf?: string | null; facing?: number;
  width_cm?: number;
}
export interface ChocoData {
  module: string;
  roc?: number;
  quarter?: string;
  title: string;
  shelf_width_cm: number;
  weights: Record<string, number>;
  shelves: ChocoShelf[];
  kpis: {
    sku_count: number; total_facing: number; total_sales: number;
    locked: number; capacity_fill_pct?: number;
  };
  top: { label: string; score: number; sales: number }[];
  skus?: ChocoSku[];
  error?: string;
}

export type Weights = Record<string, number>;

export type ProductAddTarget = 'gondol' | 'choco3' | 'choco2';

export interface ChocolateDraftProduct {
  id: number;
  target: Exclude<ProductAddTarget, 'gondol'>;
  sku: string;
  marka: string;
  altKategori: string;
  genislikCm: number;
  tahminiSkor: number;
  yerlesim: string;
  urunTipi: string;
}

export interface CustomProductRecord {
  id: number;
  target: ProductAddTarget;
  sku: string;
  cluster_key?: string | null;
  display_name?: string | null;
  color?: string | null;
  shelf?: string | null;
  width_cm: number;
  sales?: number | null;
  marka?: string | null;
  alt_kategori?: string | null;
  tahmini_skor?: number | null;
  yerlesim?: string | null;
  urun_tipi?: string | null;
}

export type CustomProductPayload = Omit<CustomProductRecord, 'id'>;
