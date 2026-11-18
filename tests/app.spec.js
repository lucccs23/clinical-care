import { expect, test } from '@playwright/test';

test('abre o painel sem erros de página', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Painel de Plantão');
  await expect(page.getByRole('heading', { name: 'Biblioteca clínica' })).toBeVisible();
  expect(errors).toEqual([]);
});
