import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import { pdfFicticio } from './dados-ficticios.js';

const require = createRequire(import.meta.url);
const { version } = JSON.parse(await readFile(require.resolve('pdfjs-dist/package.json'), 'utf8'));

test('embute o pdf.js e lê o texto de um PDF sem rede e sem worker separado', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  page.on('worker', (worker) => errors.push(`worker criado: ${worker.url()}`));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Biblioteca clínica' })).toBeVisible();

  const { buffer } = pdfFicticio([['Primeira página fictícia'], ['Droga Teste 2 mg/kg (máx. 10 mg)', 'Linha final']]);
  const pages = await page.evaluate(async (bytes) => {
    // O pdf.js roda como módulo: o título pode aparecer antes dele, mas DOMContentLoaded só vem depois.
    if (document.readyState === 'loading') await new Promise((done) => document.addEventListener('DOMContentLoaded', done, { once: true }));
    const task = globalThis.pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
    const pdf = await task.promise;
    const result = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const content = await (await pdf.getPage(n)).getTextContent();
      result.push(content.items.map((item) => item.str + (item.hasEOL ? '\n' : '')).join(''));
    }
    await task.destroy();
    return { version: globalThis.pdfjsLib.version, result };
  }, [...buffer]);

  expect(pages.version).toBe(version);
  expect(pages.result).toHaveLength(2);
  expect(pages.result[0]).toContain('Primeira página fictícia');
  expect(pages.result[1]).toContain('Droga Teste 2 mg/kg (máx. 10 mg)');
  expect(requests.filter((url) => !url.startsWith('http://127.0.0.1:4173/'))).toEqual([]);
  expect(errors).toEqual([]);
});
