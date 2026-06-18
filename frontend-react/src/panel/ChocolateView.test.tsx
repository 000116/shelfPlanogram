import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChocoData } from '../types'
import ChocolateView from './ChocolateView'

const baseData: ChocoData = {
  module: '3',
  title: 'Çikolata Planogram Final (3 Modül)',
  shelf_width_cm: 100,
  weights: {
    satis: 0.22,
    birim_kar: 0.15,
    c2: 0.1,
    ciro_pay: 0.15,
    niel_gas: 0.2,
    niel_spm: 0.08,
    deli2go: 0.1,
  },
  shelves: [
    {
      raf: 1,
      mult: 1.3,
      cap_cm: 100,
      used_cm: 10,
      used_facing: 1,
      cards: [{
        name: 'FREE SKU',
        label: 'FREE SKU',
        brand: 'Brand',
        color: '#1565c0',
        facing: 1,
        score: 20,
        width_cm: 5,
        unit_w: 5,
        sales: 100,
        sub: 'Çikolata',
        locked: false,
      }],
    },
    {
      raf: 5,
      mult: 1,
      cap_cm: 100,
      used_cm: 10,
      used_facing: 1,
      package_only: true,
      cards: [{
        name: 'LOCKED SKU',
        label: 'LOCKED SKU',
        brand: 'Brand',
        color: '#ef6c00',
        facing: 1,
        score: 30,
        width_cm: 5,
        unit_w: 5,
        sales: 50,
        sub: 'Çikolata',
        locked: true,
      }],
    },
  ],
  kpis: {
    sku_count: 2,
    total_facing: 2,
    total_sales: 150,
    locked: 1,
    capacity_fill_pct: 10,
  },
  top: [{ label: 'LOCKED SKU', score: 30, sales: 50 }],
}

describe('ChocolateView locked product behavior', () => {
  it('renders locked cards as non-draggable', () => {
    render(
      <ChocolateView
        data={baseData}
        shelf="ALL"
        weights={baseData.weights}
        onWeightChange={vi.fn()}
      />,
    )

    expect(screen.getByTitle('LOCKED SKU · skor 30 · 1 yüz')).toHaveAttribute('draggable', 'false')
    expect(screen.getByTitle('FREE SKU · skor 20 · 1 yüz')).toHaveAttribute('draggable', 'true')
  })

  it('does not mark the layout edited when dropping onto a locked card', () => {
    render(
      <ChocolateView
        data={baseData}
        shelf="ALL"
        weights={baseData.weights}
        onWeightChange={vi.fn()}
      />,
    )

    fireEvent.dragStart(screen.getByTitle('FREE SKU · skor 20 · 1 yüz'))
    fireEvent.drop(screen.getByTitle('LOCKED SKU · skor 30 · 1 yüz'))

    expect(screen.queryByRole('button', { name: 'Düzeni Sıfırla' })).not.toBeInTheDocument()
  })
})
