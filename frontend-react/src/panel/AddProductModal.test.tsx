import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AddProductModal from './AddProductModal'

const noop = vi.fn()

function renderModal(overrides = {}) {
  return render(
    <AddProductModal
      open
      onClose={noop}
      gondolProducts={[]}
      onAddGondol={noop}
      onRemoveGondol={noop}
      chocolateProducts={[]}
      onAddChocolate={noop}
      onRemoveChocolate={noop}
      {...overrides}
    />,
  )
}

describe('AddProductModal', () => {
  it('shows chocolate selects after selecting a chocolate target', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.selectOptions(
      screen.getByLabelText('Ürün eklenecek raf'),
      'choco3',
    )

    expect(screen.getByLabelText('Alt kategori')).toBeInTheDocument()
    expect(screen.getByLabelText('Yerleşim')).toBeInTheDocument()
    expect(screen.getByLabelText('Ürün tipi')).toBeInTheDocument()
    expect(screen.getByLabelText('Yerleşim')).toHaveDisplayValue('Serbest')
    expect(screen.getByLabelText('Ürün tipi')).toHaveDisplayValue('Mevcut')
  })

  it('updates alt kategori options when chocolate target changes', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.selectOptions(screen.getByLabelText('Ürün eklenecek raf'), 'choco3')
    expect(screen.getByLabelText('Alt kategori')).toHaveDisplayValue('Bar')
    expect(screen.getByRole('option', { name: 'Premium' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Ürün eklenecek raf'), 'choco2')
    expect(screen.getByLabelText('Alt kategori')).toHaveDisplayValue('Bar')
    expect(screen.queryByRole('option', { name: 'Premium' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Yerleşim')).toHaveDisplayValue('Serbest')
    expect(screen.queryByRole('option', { name: 'Kilitli' })).not.toBeInTheDocument()
  })

  it('submits chocolate final data with selected dropdown values', async () => {
    const user = userEvent.setup()
    const onAddChocolate = vi.fn()
    renderModal({ onAddChocolate })

    await user.selectOptions(screen.getByLabelText('Ürün eklenecek raf'), 'choco2')
    await user.type(screen.getByPlaceholderText('SKU'), 'TEST SKU')
    await user.type(screen.getByPlaceholderText('Marka'), 'Test Marka')
    await user.selectOptions(screen.getByLabelText('Alt kategori'), 'Tablet')
    await user.type(screen.getByPlaceholderText('Genişlik (cm)'), '4.5')
    await user.type(screen.getByPlaceholderText('Tahmini skor'), '42')
    await user.selectOptions(screen.getByLabelText('Yerleşim'), 'Serbest')
    await user.selectOptions(screen.getByLabelText('Ürün tipi'), 'Yeni')
    await user.click(screen.getByRole('button', { name: 'Ekle' }))

    expect(onAddChocolate).toHaveBeenCalledWith({
      target: 'choco2',
      sku: 'TEST SKU',
      marka: 'Test Marka',
      altKategori: 'Tablet',
      genislikCm: 4.5,
      tahminiSkor: 42,
      yerlesim: 'Serbest',
      urunTipi: 'Yeni',
    })
  })
})
