import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { txt } from '../.claude/skills/verify/fixtures.js';

test('pode ser instalado no celular, com manifesto e ícones', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'apple-touch-icon.png');

  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'Orvia', short_name: 'Orvia', start_url: './', scope: './', display: 'standalone', lang: 'pt-BR' });
  expect(manifest.icons.map((icon) => icon.purpose)).toEqual(['any', 'any', 'maskable']);

  // Cada ícone existe e tem o tamanho declarado.
  const icons = [...manifest.icons.map((icon) => [icon.src, icon.sizes]), ['apple-touch-icon.png', '180x180']];
  for (const [src, sizes] of icons) {
    const real = await page.evaluate(
      (url) => new Promise((done, fail) => Object.assign(new Image(), { onload() { done(`${this.naturalWidth}x${this.naturalHeight}`); }, onerror: fail, src: url })),
      src,
    );
    expect(real, src).toBe(sizes);
  }
});

test('abre sem internet depois da primeira visita, com os dados guardados', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#file').setInputFiles(txt);
  await page.locator('[data-commit]').click();
  await expect(page.locator('#toast')).toHaveText('1 arquivo importado');
  // Espera o service worker assumir a página, o que acontece uma vez, na primeira visita.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((done) => navigator.serviceWorker.addEventListener('controllerchange', done, { once: true }));
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Biblioteca clínica' })).toBeVisible();
  await page.locator('.side').getByRole('button', { name: 'Outros' }).click();
  await expect(page.getByRole('heading', { name: 'anotacao', exact: true })).toBeVisible();
  // O leitor de PDF embutido também está na cópia guardada.
  expect(await page.evaluate(() => typeof globalThis.pdfjsLib)).toBe('object');
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test('não liga o modo celular quando o arquivo é aberto direto', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await expect(page.getByRole('heading', { name: 'Biblioteca clínica' })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);
  expect(await page.evaluate(() => navigator.serviceWorker?.controller ?? null)).toBeNull();
});
