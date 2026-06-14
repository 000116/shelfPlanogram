import { expect, test } from '@playwright/test'
import { loginAsAdmin, openChocolate3Module } from './helpers'

test.describe('Planogram8 — sistem testleri (Playwright E2E)', () => {
  test('1 · login ekranı demo hesapları listeler', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Planogram' })).toBeVisible()
    await expect(page.getByText('Shell · Raf optimizasyonu')).toBeVisible()
    await expect(page.getByText('Demo hesaplar (yerel)')).toBeVisible()
    await expect(page.locator('code', { hasText: 'admin' })).toBeVisible()
    await expect(page.getByText(/admin123/)).toBeVisible()
  })

  test('2 · admin giriş yapar ve çikolata planogramını açar', async ({ page }) => {
    await loginAsAdmin(page)
    await openChocolate3Module(page)

    await expect(page.locator('.page-title').filter({ hasText: 'Çikolata Planogram Final (3 Modül)' })).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('Toplam Facing')).toBeVisible()
    await expect(page.getByRole('button', { name: /Ürün Listesi \(\d+\)/ })).toBeVisible()
    await expect(page.getByText('Kilitli (alt raf)')).toBeVisible()
  })

  test('3 · admin giriş sonrası gondol planogramını görür', async ({ page }) => {
    await loginAsAdmin(page)

    await expect(page.getByRole('heading', { name: 'Raf filtrele' })).toBeVisible()
    await expect(page.getByText('Gondol başı')).toBeVisible()
    await expect(page.getByText('Gondolbaşı Dolabı')).toBeVisible()
    await expect(page.locator('.station-select')).toBeVisible()
    await expect(page.locator('.cabinet-roc')).toContainText(/ROC \d+/)
    await expect(page.locator('.shelf-name').filter({ hasText: 'Üst Raf' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'PNG aktar' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Ürün Ekle' })).toBeEnabled()
  })

  test('4 · çıkış login ekranına döner', async ({ page }) => {
    await loginAsAdmin(page)

    await page.getByRole('button', { name: 'Çıkış' }).click()

    await expect(page.getByRole('button', { name: 'Giriş yap' })).toBeVisible()
    await expect(page.getByLabel('Kullanıcı adı')).toBeVisible()
    await expect(page.getByLabel('Şifre')).toBeVisible()
  })
})
