import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { doseCsv, file, txt } from '../.claude/skills/verify/fixtures.js';

const evidence = (name) => `test-results/verify-evidencias/${name}.png`;
const search = (page) => page.getByRole('searchbox', { name: 'Buscar' });
const weight = (page) => page.getByLabel('Peso do paciente em quilos');
const menu = (page, name) => page.locator('.side').getByRole('button', { name });
const record = (page, title) =>
  page.locator('article.rec').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const calculator = (page, id) => page.locator(`#${id}`);
const result = (page, id) => calculator(page, id).locator('.out');

async function fill(page, id, values) {
  for (const [label, value] of Object.entries(values)) {
    await calculator(page, id).getByLabel(label).fill(value);
  }
}

async function importFiles(page, files) {
  await page.locator('#file').setInputFiles(files);
  await page.locator('[data-commit]').click();
  await expect(page.getByRole('dialog', { name: 'Importar arquivos' })).toBeHidden();
}

async function writeRecord(page, title, text) {
  await page.getByRole('button', { name: 'Novo registro' }).click();
  const dialog = page.getByRole('dialog', { name: 'Novo registro' });
  await dialog.getByLabel('Título').fill(title);
  await dialog.getByLabel('Texto').fill(text);
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  return dialog;
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

test('calcula as fórmulas novas', async ({ page }) => {
  await menu(page, 'Calculadoras').click();
  const cases = [
    ['c-ckdepi', { 'Idade (anos)': '60', 'Creatinina (mg/dL)': '1' }, '86,2 mL/min/1,73 m²'],
    [
      'c-agalb',
      { 'Sódio (mEq/L)': '140', 'Cloro (mEq/L)': '100', 'Bicarbonato (mEq/L)': '24', 'Albumina (g/dL)': '2' },
      '21 mEq/L',
    ],
    ['c-osm', { 'Sódio (mEq/L)': '140', 'Glicose (mg/dL)': '90', 'Ureia (mg/dL)': '30' }, '290 mOsm/L'],
    ['c-ca', { 'Cálcio total (mg/dL)': '8', 'Albumina (g/dL)': '2' }, '9,6 mg/dL'],
    ['c-agua', { 'Peso (kg)': '70', 'Sódio (mEq/L)': '160' }, '6 L'],
    ['c-gota', { 'Volume (mL)': '500', 'Tempo (horas)': '8' }, '20,8 gotas/min · 62,5 microgotas/min'],
    ['c-parkland', { 'Peso (kg)': '70', 'Superfície queimada (%)': '40' }, '11.200 mL em 24 h · 700 mL/h nas primeiras 8 h'],
    ['c-imc', { 'Peso (kg)': '70', 'Altura (cm)': '175' }, '22,9 kg/m²'],
    ['c-sc', { 'Peso (kg)': '70', 'Altura (cm)': '175' }, '1,84 m²'],
    ['c-pam', { 'PAS (mmHg)': '120', 'PAD (mmHg)': '80' }, '93,3 mmHg'],
    ['c-qtc', { 'QT (ms)': '400', 'Frequência cardíaca (bpm)': '100' }, '516,4 ms'],
    ['c-pf', { 'PaO₂ (mmHg)': '80', 'FiO₂ (%)': '40' }, '200 mmHg'],
  ];
  for (const [id, values, expected] of cases) {
    await fill(page, id, values);
    await expect(result(page, id)).toHaveText(expected);
  }

  await calculator(page, 'c-ckdepi').getByLabel('Sexo').selectOption('Feminino');
  await expect(result(page, 'c-ckdepi')).toHaveText('64,5 mL/min/1,73 m²');
  await calculator(page, 'c-agua').getByLabel('Sexo').selectOption('Feminino');
  await expect(result(page, 'c-agua')).toHaveText('5 L');
});

test('recusa valores fora do domínio da fórmula', async ({ page }) => {
  await menu(page, 'Calculadoras').click();
  const cases = [
    ['c-ckdepi', { 'Idade (anos)': '10', 'Creatinina (mg/dL)': '1' }],
    ['c-agua', { 'Peso (kg)': '70', 'Sódio (mEq/L)': '135' }],
    ['c-parkland', { 'Peso (kg)': '70', 'Superfície queimada (%)': '120' }],
    ['c-pam', { 'PAS (mmHg)': '80', 'PAD (mmHg)': '120' }],
    ['c-pf', { 'PaO₂ (mmHg)': '80', 'FiO₂ (%)': '10' }],
  ];
  for (const [id, values] of cases) {
    await fill(page, id, values);
    await expect(result(page, id)).toHaveText('Confira os valores');
  }
});

test('soma os escores', async ({ page }) => {
  await menu(page, 'Calculadoras').click();
  await page.getByRole('button', { name: /^Escores/ }).click();
  await expect(page.locator('article.calc')).toHaveCount(4);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: evidence('escores-desktop'), fullPage: true });

  const glasgow = calculator(page, 'c-glasgow');
  await expect(result(page, 'c-glasgow')).toHaveText('15 pontos · leve');
  await glasgow.getByLabel('Abertura ocular').selectOption('2 · À pressão');
  await glasgow.getByLabel('Resposta verbal').selectOption('2 · Sons');
  await glasgow.getByLabel('Resposta motora').selectOption('4 · Flexão normal');
  await expect(result(page, 'c-glasgow')).toHaveText('8 pontos · grave');

  await expect(result(page, 'c-qsofa')).toHaveText('0 pontos');
  await calculator(page, 'c-qsofa').getByLabel('PAS ≤ 100 mmHg').check();
  await expect(result(page, 'c-qsofa')).toHaveText('1 ponto');

  await calculator(page, 'c-curb').getByLabel('Confusão mental').check();
  await calculator(page, 'c-curb').getByLabel('Idade ≥ 65 anos').check();
  await expect(result(page, 'c-curb')).toHaveText('2 pontos');

  const cha = calculator(page, 'c-cha');
  await cha.getByLabel('Idade').selectOption('2 · 75 anos ou mais');
  await cha.getByLabel('Sexo').selectOption('1 · Feminino');
  await cha.getByLabel('AVC, AIT ou tromboembolismo prévio').check();
  await cha.getByLabel('Hipertensão').check();
  await expect(result(page, 'c-cha')).toHaveText('6 pontos');
});

test('mantém os valores ao redesenhar, copia e limpa sem salvar', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await menu(page, 'Calculadoras').click();
  await fill(page, 'c-imc', { 'Peso (kg)': '70', 'Altura (cm)': '175' });
  await page.getByRole('button', { name: 'Favoritar IMC' }).click();
  await expect(result(page, 'c-imc')).toHaveText('22,9 kg/m²');

  await page.getByRole('button', { name: 'Copiar resultado de IMC' }).click();
  await expect(page.locator('#toast')).toHaveText('Copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('IMC: 22,9 kg/m²');

  await weight(page).fill('80');
  await expect(calculator(page, 'c-imc').getByLabel('Peso (kg)')).toHaveValue('80');
  await expect(calculator(page, 'c-imc').getByLabel('Altura (cm)')).toHaveValue('175');

  await page.getByRole('button', { name: 'Limpar IMC' }).click();
  await expect(calculator(page, 'c-imc').getByLabel('Altura (cm)')).toHaveValue('');
  await expect(calculator(page, 'c-imc').getByLabel('Peso (kg)')).toHaveValue('80');

  await fill(page, 'c-imc', { 'Altura (cm)': '175' });
  await page.reload();
  await menu(page, 'Calculadoras').click();
  await expect(calculator(page, 'c-imc').getByLabel('Altura (cm)')).toHaveValue('');
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain('175');
});

test('filtra a busca por categoria e destaca o termo sem criar HTML', async ({ page }) => {
  await importFiles(page, [
    file('prescricoes-teste.csv', 'nome;obs\nSódio Fictício;<b>sodio</b> importado\n'),
  ]);

  await search(page).fill('sodio');
  await expect(page.getByRole('button', { name: /^Todos/ })).toBeVisible();
  await expect(record(page, 'Sódio Fictício').locator('h3 mark')).toHaveText('Sódio');
  await expect(record(page, 'Sódio Fictício').locator('dd b')).toHaveCount(0);
  await expect(record(page, 'Sódio Fictício').locator('dd')).toContainText('<b>sodio</b> importado');

  await page.getByRole('button', { name: /^Calculadoras/ }).last().click();
  await expect(record(page, 'Sódio Fictício')).toHaveCount(0);
  await expect(record(page, 'Sódio corrigido')).toBeVisible();

  await page.locator('#view').getByRole('button', { name: /^Prescrições/ }).click();
  await expect(record(page, 'Sódio Fictício')).toBeVisible();
  await expect(page.locator('article.calc')).toHaveCount(0);
});

test('escreve registros no painel e recusa nome repetido', async ({ page }) => {
  await menu(page, 'Prescrições').click();
  await page.getByRole('button', { name: 'Escrever registro' }).click();
  const empty = page.getByRole('dialog', { name: 'Novo registro' });
  await empty.getByRole('button', { name: 'Salvar' }).click();
  await expect(empty).toContainText('Preencha o título e o texto.');
  await empty.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByRole('button', { name: 'Escrever registro' }).click();
  await empty.getByLabel('Título').fill('Zeta fictícia');
  await empty.getByLabel('Texto').fill('Texto de exemplo');
  await empty.getByRole('button', { name: 'Salvar' }).click();
  await expect(empty).toBeHidden();
  await expect(record(page, 'Zeta fictícia')).toContainText('Texto de exemplo');

  const repeated = await writeRecord(page, 'Zeta fictícia', 'Outro texto');
  await expect(repeated).toContainText('Já existe um arquivo com esse nome.');
  await repeated.getByRole('button', { name: 'Cancelar' }).click();

  await expect((await writeRecord(page, 'Alfa fictícia', 'Primeiro'))).toBeHidden();
  await expect(page.locator('article.rec h3')).toHaveText(['Alfa fictícia', 'Zeta fictícia']);

  await page.reload();
  await menu(page, 'Prescrições').click();
  await expect(record(page, 'Zeta fictícia')).toBeVisible();
});

test('exporta e restaura a biblioteca com favoritos', async ({ page }, testInfo) => {
  await importFiles(page, [doseCsv(), txt]);
  await menu(page, 'Doses').click();
  await page.getByRole('button', { name: 'Favoritar Droga Fictícia' }).click();
  await menu(page, 'Calculadoras').click();
  await page.getByRole('button', { name: 'Favoritar IMC' }).click();
  await weight(page).fill('33');

  await menu(page, 'Arquivos').click();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: evidence('arquivos-backup'), fullPage: true });
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/^painel-plantao-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = testInfo.outputPath('backup.json');
  await download.saveAs(path);
  const content = await readFile(path, 'utf8');
  expect(content).not.toContain('"peso"');

  for (const name of ['doses-teste.csv', 'anotacao.txt']) {
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: `Excluir ${name}` }).click();
    await expect(page.getByRole('button', { name: `Excluir ${name}` })).toHaveCount(0);
  }
  await expect(page.getByText('Nenhum arquivo importado')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#restore').setInputFiles(path);
  await expect(page.locator('#toast')).toHaveText('2 arquivos restaurados');
  await page.reload();

  await menu(page, 'Favoritos').click();
  await expect(record(page, 'Droga Fictícia')).toBeVisible();
  await expect(record(page, 'IMC')).toBeVisible();
  await weight(page).fill('20');
  await expect(record(page, 'Droga Fictícia')).toContainText('100–205 mg por tomada');

  await menu(page, 'Arquivos').click();
  const textTab = page.context().waitForEvent('page');
  await page.getByRole('button', { name: 'Abrir anotacao.txt' }).click();
  await expect((await textTab).locator('body')).toContainText('nota com termotxt');
});

test('recusa backup inválido sem alterar a biblioteca', async ({ page }) => {
  await importFiles(page, [txt]);
  await menu(page, 'Arquivos').click();
  const data = Buffer.from('<script>window.invadido=true</script>').toString('base64');
  const invalid = [
    '{',
    '{"app":"outro","versao":1,"files":[]}',
    JSON.stringify({
      app: 'painel-plantao',
      versao: 1,
      files: [{ name: 'pagina.html', cat: 'outros', data, recs: [{ title: 'x', doc: true }] }],
    }),
    JSON.stringify({
      app: 'painel-plantao',
      versao: 1,
      files: [{ name: 'nota.txt', cat: 'inexistente', data, recs: [{ title: 'x' }] }],
    }),
  ];

  for (const [index, content] of invalid.entries()) {
    await page.locator('#toast').evaluate((element) => (element.textContent = ''));
    await page.locator('#restore').setInputFiles(file(`invalido-${index}.json`, content, 'application/json'));
    await expect(page.locator('#toast')).toHaveText('Backup inválido ou corrompido');
  }
  await expect(page.locator('.ft')).toHaveCount(1);
  await expect(page.getByText('anotacao.txt', { exact: true })).toBeVisible();
});

test('troca entre todos os temas e guarda a escolha', async ({ page }) => {
  const html = page.locator('html');
  const themes = {
    Petróleo: 'dark',
    Papel: 'light',
    Céu: 'ceu',
    'Noite azul': 'noite',
    Grafite: 'grafite',
    'Plantão noturno': 'noturno',
    'Alto contraste': 'contraste',
  };
  await importFiles(page, [doseCsv()]);
  await weight(page).fill('20');
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole('button', { name: 'Mais temas' }).click();
  const dialog = page.getByRole('dialog', { name: 'Aparência' });
  await expect(dialog.locator('.tcard')).toHaveCount(8);
  await page.screenshot({ path: evidence('temas-escolha') });

  for (const [name, id] of Object.entries(themes)) {
    await dialog.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    await expect(html).toHaveAttribute('data-theme', id);
    await expect(dialog.getByRole('button', { name: new RegExp(`^${name}`) })).toHaveAttribute('aria-pressed', 'true');
  }
  await dialog.getByRole('button', { name: 'Fechar' }).click();
  for (const id of Object.values(themes)) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, id);
    await page.screenshot({ path: evidence(`tema-${id}`) });
  }

  await page.getByRole('button', { name: 'Mais temas' }).click();
  await dialog.getByRole('button', { name: /^Noite azul/ }).click();
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'noite');
  await expect(page.getByRole('button', { name: 'Mais temas' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Tema escuro' })).toHaveAttribute('aria-pressed', 'false');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.getByRole('button', { name: 'Mais temas' }).click();
  await dialog.getByRole('button', { name: /^Automático/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(html).toHaveAttribute('data-theme', 'light');

  await dialog.getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: 'Tema escuro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: 'Tema escuro' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Mais temas' })).toHaveAttribute('aria-pressed', 'false');
});
