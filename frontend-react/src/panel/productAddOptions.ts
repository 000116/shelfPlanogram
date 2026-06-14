import type { ProductAddTarget } from '../types'
import { CLUSTER_DISPLAY } from './gondolConstants'

export const URUN_TIPI_OPTIONS = ['Mevcut', 'Yeni'] as const

/** Alt kategori seçenekleri — seçilen raf/hedefe göre değişir. */
export const ALT_KATEGORI_BY_TARGET: Record<ProductAddTarget, string[]> = {
  gondol: Object.values(CLUSTER_DISPLAY).sort((a, b) => a.localeCompare(b, 'tr')),
  choco3: ['Bar', 'Tablet', 'Gofret', 'Kaplamalı', 'Premium', 'Çikolata'],
  choco2: ['Bar', 'Tablet', 'Gofret', 'Kaplamalı', 'Çikolata'],
}

/** Yerleşim — 3 modülde alt raf (kilitli) ayrımı vardır. */
export const YERLESIM_BY_TARGET: Record<Exclude<ProductAddTarget, 'gondol'>, string[]> = {
  choco3: ['Serbest', 'Kilitli'],
  choco2: ['Serbest'],
}

export function defaultAltKategori(target: ProductAddTarget): string {
  return ALT_KATEGORI_BY_TARGET[target][0] ?? ''
}

export function defaultYerlesim(target: Exclude<ProductAddTarget, 'gondol'>): string {
  return YERLESIM_BY_TARGET[target][0] ?? ''
}

export function gondolClusterKeyForAltKategori(label: string): string {
  const entry = Object.entries(CLUSTER_DISPLAY).find(([, display]) => display === label)
  return entry?.[0] ?? Object.keys(CLUSTER_DISPLAY)[0] ?? ''
}

export function gondolAltKategoriForCluster(clusterKey: string): string {
  return CLUSTER_DISPLAY[clusterKey] ?? clusterKey
}
