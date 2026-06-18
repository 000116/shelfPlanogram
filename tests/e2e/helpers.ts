import { expect, type Page } from '@playwright/test'

export async function loginAsAdmin(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Planogram' })).toBeVisible()
  await page.getByLabel('Kullanıcı adı').fill('admin')
  await page.getByLabel('Şifre').fill('admin123')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByText('Shell · Raf optimizasyonu · Yönetici paneli')).toBeVisible()
}

export async function openChocolate3Module(page: Page) {
  const chocoArea = page.locator('.fixture-area').filter({
    hasText: 'Çikolata Planogram Final · 3 Modül',
  })
  await chocoArea.getByRole('button', { name: 'Tüm raflar' }).click()
}
