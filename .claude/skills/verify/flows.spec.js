import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';
import { allFormats, doseCsv, file, pdf, txt, xlsx } from './fixtures.js';

const evidence = (name) => `test-results/verify-evidencias/${name}.png`;
const weight = (page) => page.getByLabel('Peso do paciente em quilos');
const search = (page) => page.getByRole('searchbox', { name: 'Buscar' });
const record = (page, title) =>
  page.locator('article.rec').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const legend = (page, name) => page.locator('.leg > div').filter({ hasText: name }).locator('b');
const menu = (page, name) => page.locator('.side').getByRole('button', { name, exact: false });

async function chooseFiles(page, files) {
  await page.locator('#file').setInputFiles(files);
  await expect(page.getByRole('dialog', { name: 'Importar arquivos' })).toBeVisible();
}

async function confirmImport(page) {
  await page.locator('[data-commit]').click();
  await expect(page.getByRole('dialog', { name: 'Importar arquivos' })).toBeHidden();
}

async function importFiles(page, files) {
  await chooseFiles(page, files);
  await confirmImport(page);
  await expect(page.locator('#toast')).toContainText('importado');
}

let errors;
let externalRequests;

test.beforeEach(async ({ page }) => {
  errors = [];
  externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173/')) {
      externalRequests.push(request.url());
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Biblioteca clínica' })).toBeVisible();
});

test.afterEach(() => {
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('importa todos os formatos e encontra o conteúdo na busca', async ({ page }) => {
  await importFiles(page, allFormats);

  await expect(legend(page, 'Doses')).toHaveText('2');
  await expect(legend(page, 'Prescrições')).toHaveText('1');
  await expect(legend(page, 'Protocolos')).toHaveText('1');
  await expect(legend(page, 'Outros')).toHaveText('5');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: evidence('visao-geral-desktop'), fullPage: true });

  const expected = {
    ficticia: 'Droga Fictícia',
    'teste planilha': 'Teste Planilha',
    termodocx: 'protocolo-teste',
    termotxt: 'anotacao',
    termomd: 'resumo',
    termotsv: 'Item TSV',
    termojson: 'Item JSON',
    guia: 'guia',
    imagem: 'imagem',
  };
  for (const [term, title] of Object.entries(expected)) {
    await search(page).fill(term);
    await expect(record(page, title)).toBeVisible();
  }
});

test('importa arquivos arrastados para a tela', async ({ page }) => {
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(['nota arrastada'], 'arrastado.txt', { type: 'text/plain' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
  });

  await expect(page.getByRole('dialog', { name: 'Importar arquivos' })).toContainText('arrastado.txt');
});

test('recusa arquivos inválidos sem permitir importação', async ({ page }) => {
  await chooseFiles(page, [
    file('programa.exe', 'x'),
    file('quebrado.xlsx', 'não é zip'),
    file('so-cabecalho.csv', 'nome;dose\n'),
    file('quebrado.json', '{'),
  ]);

  const dialog = page.getByRole('dialog', { name: 'Importar arquivos' });
  await expect(dialog).toContainText('Formato não aceito');
  await expect(dialog).toContainText('Arquivo compactado inválido');
  await expect(dialog).toContainText('Nenhum registro encontrado');
  await expect(dialog).toContainText('Conteúdo inválido');
  await expect(page.locator('[data-commit]')).toBeDisabled();
});

test('mostra conteúdo importado como texto', async ({ page }) => {
  const title = '<img src=x onerror="window.invadido=true">';
  await importFiles(page, [file('seguro.csv', `nome,obs\n"${title.replaceAll('"', '""')}",ok\n`)]);
  await menu(page, 'Outros').click();

  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.invadido)).toBeUndefined();
});

test('calcula a dose pelo peso e respeita o limite do arquivo', async ({ page }) => {
  await importFiles(page, [doseCsv(), xlsx]);
  await menu(page, 'Doses').click();
  const dose = record(page, 'Droga Fictícia');

  await expect(dose).toContainText('Informe o peso');
  await weight(page).fill('20');
  await expect(dose).toContainText('100–205 mg por tomada = 2–4,1 mL');
  await expect(dose).not.toContainText('Limite de dose aplicado');
  await expect(record(page, 'Teste Planilha')).toContainText('10 mg');

  await weight(page).fill('40');
  await expect(dose).toContainText('200–300 mg por tomada = 4–6 mL');
  await expect(dose).toContainText('Limite de dose aplicado');

  await weight(page).fill('0');
  await expect(dose).toContainText('Informe o peso');
});

test('mantém arquivos e favoritos ao recarregar, mas não mantém o peso', async ({ page }) => {
  await importFiles(page, [doseCsv()]);
  await weight(page).fill('20');
  await menu(page, 'Doses').click();
  await page.getByRole('button', { name: 'Favoritar Droga Fictícia' }).click();

  await page.reload();

  await expect(weight(page)).toHaveValue('');
  await menu(page, 'Favoritos').click();
  await expect(record(page, 'Droga Fictícia')).toBeVisible();
});

test('mantém os dados ao abrir o arquivo diretamente', async ({ page }) => {
  await page.goto(pathToFileURL(resolve('dist/index.html')).href);
  await importFiles(page, [txt]);

  await page.reload();

  await menu(page, 'Outros').click();
  await expect(record(page, 'anotacao')).toBeVisible();
});

test('substitui ou mantém a versão anterior conforme a escolha', async ({ page }) => {
  await importFiles(page, [doseCsv('Versão Antiga')]);
  await importFiles(page, [doseCsv('Versão Nova')]);
  await search(page).fill('versao');
  await expect(page.locator('article.rec')).toHaveCount(1);
  await expect(record(page, 'Versão Nova')).toBeVisible();

  await search(page).fill('');
  await chooseFiles(page, [doseCsv('Versão Extra')]);
  await page.getByLabel('Substituir a versão anterior').uncheck();
  await confirmImport(page);
  await search(page).fill('versao');
  await expect(page.locator('article.rec')).toHaveCount(2);
});

test('gerencia categoria e exclusão de arquivos', async ({ page }) => {
  await importFiles(page, [txt]);
  await menu(page, 'Arquivos').click();
  await page.locator('#view').getByLabel('Categoria de anotacao.txt').selectOption('protocolos');
  await menu(page, 'Protocolos').click();
  await expect(record(page, 'anotacao')).toBeVisible();

  await menu(page, 'Arquivos').click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Excluir anotacao.txt' }).click();
  await expect(page.getByText('anotacao.txt', { exact: true })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Excluir anotacao.txt' }).click();
  await expect(page.getByText('Nenhum arquivo importado')).toBeVisible();
});

test('abre e baixa os arquivos originais', async ({ page, context }) => {
  await importFiles(page, [txt, pdf, xlsx]);
  await menu(page, 'Arquivos').click();

  const textTab = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Abrir anotacao.txt' }).click();
  await expect((await textTab).locator('body')).toContainText('nota com termotxt');

  // O Chromium sem interface não renderiza PDF, então a prova é o arquivo entregue à nova aba.
  await page.evaluate(() => {
    window.open = (url) => {
      window.abertoEm = url;
      return null;
    };
  });
  await page.getByRole('button', { name: 'Abrir guia.pdf' }).click();
  const opened = await page.evaluate(async () => {
    const blob = await (await fetch(window.abertoEm)).blob();
    return { type: blob.type, text: await blob.text() };
  });
  expect(opened).toEqual({ type: 'application/pdf', text: '%PDF-1.4\n%%EOF\n' });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Abrir tabela.xlsx' }).click();
  expect((await download).suggestedFilename()).toBe('tabela.xlsx');
});

test('copia um registro e baixa o modelo de doses', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await importFiles(page, [doseCsv()]);
  await menu(page, 'Doses').click();
  await record(page, 'Droga Fictícia').getByRole('button', { name: 'Copiar' }).click();
  await expect(page.locator('#toast')).toHaveText('Copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('indicacao: Uso; teste');

  await menu(page, 'Arquivos').click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar modelo de doses' }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('modelo-doses.csv');
  expect(await readFile(await download.path(), 'utf8')).toContain('dose_min_kg;dose_max_kg');
});

test('calcula as fórmulas das calculadoras', async ({ page }) => {
  await menu(page, 'Calculadoras').click();
  const calculator = (id) => page.locator(`#${id}`);
  const fill = async (id, values) => {
    for (const [label, value] of Object.entries(values)) await calculator(id).getByLabel(label).fill(value);
  };

  await fill('c-clcr', { 'Idade (anos)': '60', 'Peso (kg)': '70', 'Creatinina (mg/dL)': '1' });
  await expect(calculator('c-clcr').locator('.out')).toHaveText('77,8 mL/min');
  await calculator('c-clcr').getByLabel('Sexo').selectOption('Feminino');
  await expect(calculator('c-clcr').locator('.out')).toHaveText('66,1 mL/min');

  await fill('c-inf', {
    'Dose (mcg/kg/min)': '0.1',
    'Peso (kg)': '70',
    'Droga na solução (mg)': '4',
    'Volume total (mL)': '250',
  });
  await expect(calculator('c-inf').locator('.out')).toHaveText('26,3 mL/h');

  await fill('c-holliday', { 'Peso (kg)': '20' });
  await expect(calculator('c-holliday').locator('.out')).toHaveText('1.500 mL/dia · 62,5 mL/h');

  await fill('c-ag', { 'Sódio (mEq/L)': '140', 'Cloro (mEq/L)': '100', 'Bicarbonato (mEq/L)': '24' });
  await expect(calculator('c-ag').locator('.out')).toHaveText('16 mEq/L');

  await fill('c-na', { 'Sódio (mEq/L)': '130', 'Glicose (mg/dL)': '300' });
  await expect(calculator('c-na').locator('.out')).toHaveText('133,2 mEq/L');
});

test('mantém o tema e funciona no celular sem rolagem lateral', async ({ page }) => {
  await importFiles(page, allFormats);
  await page.getByRole('button', { name: 'Tema claro' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole('button', { name: 'Importar', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: evidence('visao-geral-celular'), fullPage: true });
});
