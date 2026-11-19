import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { file } from '../.claude/skills/verify/fixtures.js';
import { cenariosFicticios } from './dados-ficticios.js';

const evidence = (name) => `test-results/verify-evidencias/${name}.png`;
const menu = (page, name) => page.locator('.side').getByRole('button', { name });
const editor = (page) => page.getByRole('dialog', { name: /cenário$/ });
const row = (page, n) => editor(page).locator('fieldset').nth(n);

async function fillRow(page, n, values) {
  for (const [label, value] of Object.entries(values)) {
    await row(page, n).getByLabel(label, { exact: true }).fill(value);
  }
}

async function createScenario(page, title, items) {
  await menu(page, 'Prescrições').click();
  await page.getByRole('button', { name: 'Novo cenário' }).click();
  await editor(page).getByLabel('Nome do cenário').fill(title);
  for (const [n, values] of items.entries()) {
    if (n) await editor(page).getByRole('button', { name: 'Adicionar medicamento' }).click();
    await fillRow(page, n, values);
  }
  await editor(page).getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(editor(page)).toBeHidden();
}

let errors;

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Biblioteca clínica' })).toBeVisible();
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

test('cria, mostra, edita e reordena um cenário', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await createScenario(page, 'Choque fictício', [
    { Medicamento: 'Droga A', 'Apresentação ou preparo': 'Bolsa A', 'Dose e posologia': '2 unidades', Via: 'Endovenosa', Referência: 'Livro A p.10' },
    { Medicamento: 'Droga B', 'Dose e posologia': '1 unidade' },
  ]);

  await expect(page.locator('#title')).toHaveText('Choque fictício');
  const items = page.locator('.rxi');
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('Droga A');
  await expect(items.first()).toContainText('Bolsa A');
  await expect(items.first()).toContainText('Via Endovenosa');
  await expect(items.first()).toContainText('Livro A p.10');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: evidence('cenario-detalhe') });

  await page.getByRole('button', { name: 'Copiar prescrição' }).click();
  // A área de transferência do Windows grava quebras de linha como \r\n.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n')).toBe(
    'Choque fictício\n\n1. Droga A — Bolsa A\n   2 unidades · Via Endovenosa\n   Fonte: Livro A p.10\n2. Droga B\n   1 unidade',
  );

  await page.getByRole('button', { name: 'Editar' }).click();
  await editor(page).getByRole('button', { name: 'Descer medicamento 1' }).click();
  await expect(row(page, 0).getByLabel('Medicamento', { exact: true })).toHaveValue('Droga B');
  await editor(page).getByRole('button', { name: 'Remover medicamento 2' }).click();
  await editor(page).getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(page.locator('.rxi')).toHaveCount(1);
  await expect(page.locator('.rxi')).toContainText('Droga B');

  await page.reload();
  await menu(page, 'Prescrições').click();
  await expect(page.getByRole('button', { name: /^Choque fictício/ })).toContainText('1 medicamento');
  await page.screenshot({ path: evidence('cenarios-grade') });
});

test('valida nome, duplicidade e linhas incompletas', async ({ page }) => {
  await createScenario(page, 'Cenário Único', [{ Medicamento: 'Droga X' }]);
  await page.getByRole('button', { name: 'Prescrições', exact: true }).first().click();

  await page.getByRole('button', { name: 'Novo cenário' }).click();
  await editor(page).getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(editor(page)).toContainText('Dê um nome ao cenário.');

  await editor(page).getByLabel('Nome do cenário').fill('cenario único');
  await editor(page).getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(editor(page)).toContainText('Já existe um cenário com esse nome.');

  await editor(page).getByLabel('Nome do cenário').fill('Outro cenário');
  await fillRow(page, 0, { 'Dose e posologia': 'sem nome' });
  await editor(page).getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(editor(page)).toContainText('Preencha o nome de cada medicamento ou remova a linha.');
});

test('mostra conteúdo do cenário como texto', async ({ page }) => {
  const title = '<img src=x onerror="window.invadido=true">';
  await createScenario(page, title, [{ Medicamento: '<b>negrito</b>', Referência: '<script>window.invadido=true</script>' }]);
  await expect(page.locator('#title')).toHaveText(title);
  await expect(page.locator('.rxi b')).toHaveText('<b>negrito</b>');
  expect(await page.evaluate(() => window.invadido)).toBeUndefined();
});

test('acha cenários na busca e nos favoritos, e exclui com confirmação', async ({ page }) => {
  await createScenario(page, 'Asma fictícia', [{ Medicamento: 'Broncodilatador Teste', Referência: 'Manual Fictício' }]);
  await page.getByRole('button', { name: 'Favoritar Asma fictícia' }).click();

  await page.getByRole('searchbox', { name: 'Buscar' }).fill('broncodilatador');
  await page.getByRole('button', { name: /^Asma fictícia/ }).click();
  await expect(page.locator('#title')).toHaveText('Asma fictícia');

  await menu(page, 'Visão geral').click();
  await page.locator('.home').getByRole('button', { name: /Asma fictícia/ }).click();
  await expect(page.locator('#title')).toHaveText('Asma fictícia');

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Excluir' }).click();
  await expect(page.locator('#title')).toHaveText('Asma fictícia');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Excluir' }).click();
  await expect(page.locator('#toast')).toHaveText('Cenário excluído');
  await expect(page.getByRole('button', { name: /^Asma fictícia/ })).toHaveCount(0);
  await menu(page, 'Favoritos').click();
  await expect(page.getByText('Nenhum favorito ainda')).toBeVisible();
});

test('importa arquivo de cenários e substitui ou mantém os existentes', async ({ page }) => {
  await page.locator('#file').setInputFiles(cenariosFicticios(['Cenário Alfa', 'Cenário Beta']));
  const dialog = page.getByRole('dialog', { name: 'Importar arquivos' });
  await expect(dialog).toContainText('2 cenários de prescrição');
  await dialog.locator('[data-commit]').click();
  await expect(page.locator('#toast')).toHaveText('2 cenários importados');

  await menu(page, 'Prescrições').click();
  await page.getByRole('button', { name: /^Cenário Alfa/ }).click();
  await expect(page.locator('.cnote')).toHaveText('Observação fictícia');
  await expect(page.locator('.rxi')).toContainText('Livro Teste p.1');

  await page.locator('#file').setInputFiles(cenariosFicticios(['Cenário Alfa']));
  await page.getByLabel('Substituir cenários com o mesmo nome').uncheck();
  await dialog.locator('[data-commit]').click();
  await expect(dialog).toBeHidden();
  await menu(page, 'Prescrições').click();
  await expect(page.getByRole('button', { name: /^Cenário Alfa/ })).toHaveCount(1);

  await page.locator('#file').setInputFiles(
    file('ruim.json', JSON.stringify({ tipo: 'cenarios-prescricao', cenarios: [{ title: 'Sem itens' }] }), 'application/json'),
  );
  await expect(dialog).toContainText('Cenários em formato inválido');
  await expect(page.locator('[data-commit]')).toBeDisabled();
});

test('leva cenários e favoritos no backup', async ({ page }, testInfo) => {
  await createScenario(page, 'Cenário do backup', [{ Medicamento: 'Droga Backup', Referência: 'Ref Teste' }]);
  await page.getByRole('button', { name: 'Favoritar Cenário do backup' }).click();
  await menu(page, 'Arquivos').click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const path = testInfo.outputPath('backup.json');
  await (await pending).saveAs(path);
  expect(JSON.parse(await readFile(path, 'utf8')).cenarios[0].items[0].ref).toBe('Ref Teste');

  await menu(page, 'Prescrições').click();
  await page.getByRole('button', { name: /^Cenário do backup/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Excluir' }).click();
  await expect(page.locator('#toast')).toHaveText('Cenário excluído');

  await menu(page, 'Arquivos').click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#restore').setInputFiles(path);
  await expect(page.locator('#toast')).toHaveText('1 cenário restaurado');
  await menu(page, 'Favoritos').click();
  await expect(page.getByRole('button', { name: /^Cenário do backup/ })).toBeVisible();
});

test('mantém os arquivos de quem já usava a versão anterior do banco', async ({ page }) => {
  // Página do mesmo endereço sem o app, para criar o banco no formato antigo antes de abrir o painel.
  await page.goto('/versao-anterior');
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        indexedDB.deleteDatabase('painel-plantao').onsuccess = () => {
          const request = indexedDB.open('painel-plantao', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' });
          request.onsuccess = () => {
            const tx = request.result.transaction('files', 'readwrite');
            tx.objectStore('files').put({
              id: 'fantigo',
              name: 'antigo.txt',
              ext: 'txt',
              size: 5,
              cat: 'outros',
              at: 1,
              recs: [{ title: 'Registro antigo', text: 'texto' }],
              blob: new Blob(['texto']),
            });
            tx.oncomplete = () => {
              request.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        };
      }),
  );

  await page.goto('/');
  await menu(page, 'Outros').click();
  await expect(page.getByRole('heading', { name: 'Registro antigo' })).toBeVisible();
  await createScenario(page, 'Depois da migração', [{ Medicamento: 'Droga Nova' }]);
  await expect(page.locator('#title')).toHaveText('Depois da migração');
});
