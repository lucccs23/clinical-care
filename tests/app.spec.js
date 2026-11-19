import { expect, test } from '@playwright/test';

test('abre o Orvia sem erros de página', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle('Orvia');
  await expect(page.getByRole('heading', { name: 'Biblioteca clínica' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mostra o logo do Orvia na barra e na aba, embutidos no arquivo', async ({ page }) => {
  await page.goto('/');
  // O logo usa a cor do tema: muda junto com a aparência escolhida.
  const logo = page.locator('#logo svg');
  await expect(logo).toBeVisible();
  // Só o desenho aparece; o nome fica para leitores de tela.
  await expect(page.getByRole('img', { name: 'Orvia' })).toBeVisible();
  await expect(page.locator('.side')).not.toContainText('Orvia');
  const color = () => logo.evaluate((svg) => getComputedStyle(svg).color);
  const dark = await color();
  await page.getByRole('button', { name: 'Mais temas' }).click();
  await page.getByRole('button', { name: /Alto contraste/ }).click();
  expect(await color()).not.toBe(dark);
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toMatch(/^data:image\/svg\+xml,/);
});
