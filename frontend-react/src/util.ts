export const STATIC = ''

export function fmt(n: number | null | undefined): string {
  return n == null ? '—' : Number(n).toLocaleString('tr-TR')
}

export function pct(a: number, b: number): string {
  if (!b) return '0%'
  return ((a / b) * 100).toFixed(0) + '%'
}
