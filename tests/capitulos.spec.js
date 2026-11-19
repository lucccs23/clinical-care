/* global DOSE1 -- padrão de dose definido no script do app, usado dentro de page.evaluate */
import { expect, test } from '@playwright/test';
import { file, pdf as pdfInvalido } from '../.claude/skills/verify/fixtures.js';
import { pdfFicticio } from './dados-ficticios.js';

const evidence = (name) => `test-results/verify-evidencias/${name}.png`;
const menu = (page, name) => page.locator('.side').getByRole('button', { name });
const reader = (page) => page.getByRole('dialog', { name: 'Ler capítulo' });
const editor = (page) => page.getByRole('dialog', { name: /cenário$/ });
const row = (page, n) => editor(page).locator('fieldset').nth(n);
// Procura no texto do trecho, não na linha anterior que aparece como contexto.
const trecho = (page, text) => reader(page).locator('.chr').filter({ has: page.locator('.cht > span', { hasText: text }) });

// Capítulo fictício: nomes e números não vêm de nenhum livro.
const capitulo = () =>
  pdfFicticio(
    [
      ['Capítulo fictício de teste', 'Texto corrido sem dose nenhuma.', 'Droga Alfa', '0,5 mg/kg EV em bolus'],
      ['Droga Beta 2 a 4 mcg/kg/min em infusão contínua', 'Diluir 1 ampola em 100 mL de solução teste', 'Conclusão sem números.'],
    ],
    'manual-ficticio.pdf',
  );

async function openReader(page, pdf = capitulo()) {
  await menu(page, 'Prescrições').click();
  await page.locator('#chapter').setInputFiles(pdf);
  await expect(reader(page)).toBeVisible();
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

test('filtra as linhas com dose e leva os trechos para um novo cenário com a página', async ({ page }) => {
  await menu(page, 'Prescrições').click();
  await page.getByRole('button', { name: 'Ler capítulo em PDF' }).click();
  await page.locator('#chapter').setInputFiles(capitulo());

  await expect(reader(page)).toContainText('manual-ficticio.pdf · 2 páginas · 3 trechos com dose');
  await expect(reader(page).locator('.chr')).toHaveCount(3);
  await expect(trecho(page, '0,5 mg/kg EV')).toContainText('p. 1');
  await expect(trecho(page, '0,5 mg/kg EV').locator('mark')).toHaveText('0,5 mg/kg');
  await expect(trecho(page, 'Droga Beta').locator('mark')).toHaveText('2 a 4 mcg/kg/min');
  await expect(trecho(page, 'Diluir 1 ampola')).toContainText('p. 2');
  await expect(reader(page)).not.toContainText('Texto corrido sem dose');

  await reader(page).getByLabel('Mostrar todas as linhas').check();
  await expect(reader(page).locator('.chr')).toHaveCount(7);
  await reader(page).getByLabel('Mostrar todas as linhas').uncheck();
  // O filtro também olha a linha anterior: a diluição logo abaixo da Droga Beta aparece junto.
  await reader(page).getByLabel('Filtrar trechos').fill('beta');
  await expect(reader(page).locator('.chr')).toHaveCount(2);
  await expect(trecho(page, 'Diluir 1 ampola')).toBeVisible();
  await reader(page).getByLabel('Filtrar trechos').fill('alfa');
  await expect(reader(page).locator('.chr')).toHaveCount(1);
  await reader(page).getByLabel('Filtrar trechos').fill('inexistente');
  await expect(reader(page)).toContainText('Nenhum trecho com esse filtro.');
  await reader(page).getByLabel('Filtrar trechos').fill('');

  await reader(page).getByRole('button', { name: 'Levar trechos' }).click();
  await expect(reader(page)).toContainText('Selecione ao menos um trecho.');
  await trecho(page, '0,5 mg/kg EV').getByRole('checkbox').check();
  await trecho(page, 'Diluir 1 ampola').getByRole('checkbox').check();
  await expect(reader(page).getByRole('button', { name: 'Levar 2 trechos' })).toBeVisible();
  await expect(reader(page).getByRole('alert')).toHaveText('');
  await reader(page).getByLabel('Fonte para a referência').fill('Manual Fictício');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: evidence('leitor-capitulo') });
  await reader(page).getByRole('button', { name: 'Levar 2 trechos' }).click();

  await expect(editor(page)).toBeVisible();
  await expect(editor(page).getByLabel('Nome do cenário')).toHaveValue('Manual Fictício');
  await expect(editor(page).locator('fieldset')).toHaveCount(2);
  // O nome vem da linha anterior quando o trecho começa pela dose.
  await expect(row(page, 0).getByLabel('Medicamento', { exact: true })).toHaveValue('Droga Alfa');
  await expect(row(page, 0).getByLabel('Dose e posologia')).toHaveValue('0,5 mg/kg EV em bolus');
  await expect(row(page, 0).getByLabel('Referência')).toHaveValue('Manual Fictício, p. 1');
  // "Diluir" não é nome de medicamento, e a linha anterior tem números: o campo fica para a pessoa.
  await expect(row(page, 1).getByLabel('Medicamento', { exact: true })).toHaveValue('');
  await expect(row(page, 1).getByLabel('Referência')).toHaveValue('Manual Fictício, p. 2');

  await editor(page).getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(editor(page)).toContainText('Preencha o nome de cada medicamento ou remova a linha.');
  await row(page, 1).getByLabel('Medicamento', { exact: true }).fill('Droga Beta');
  await editor(page).getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(editor(page)).toBeHidden();

  await expect(page.locator('#title')).toHaveText('Manual Fictício');
  await expect(page.locator('.rxi')).toHaveCount(2);
  await expect(page.locator('.rxi').nth(1)).toContainText('Diluir 1 ampola em 100 mL de solução teste');
  await expect(page.locator('.rxi').nth(1)).toContainText('Manual Fictício, p. 2');
});

test('acrescenta trechos a um cenário que já existe, sem perder os itens dele', async ({ page }) => {
  await menu(page, 'Prescrições').click();
  await page.getByRole('button', { name: 'Novo cenário' }).click();
  await editor(page).getByLabel('Nome do cenário').fill('Cenário Existente');
  await row(page, 0).getByLabel('Medicamento', { exact: true }).fill('Droga Antiga');
  await editor(page).getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(editor(page)).toBeHidden();

  await openReader(page);
  await reader(page).getByLabel('Levar para').selectOption({ label: 'Cenário Existente' });
  await trecho(page, 'Droga Beta').getByRole('checkbox').check();
  await reader(page).getByRole('button', { name: 'Levar 1 trecho' }).click();

  await expect(editor(page)).toContainText('Editar cenário');
  await expect(editor(page).getByLabel('Nome do cenário')).toHaveValue('Cenário Existente');
  await expect(row(page, 0).getByLabel('Medicamento', { exact: true })).toHaveValue('Droga Antiga');
  await expect(row(page, 1).getByLabel('Medicamento', { exact: true })).toHaveValue('Droga Beta');
  await expect(row(page, 1).getByLabel('Referência')).toHaveValue('manual-ficticio, p. 2');
  await editor(page).getByRole('button', { name: 'Salvar cenário' }).click();
  await expect(page.locator('.rxi')).toHaveCount(2);
  await menu(page, 'Prescrições').click();
  await expect(page.getByRole('button', { name: /^Cenário Existente/ })).toHaveCount(1);
});

test('junta as linhas de uma célula de tabela em um só medicamento', async ({ page }) => {
  const tabela = () =>
    pdfFicticio([['Droga Gama 2 amp + 100', 'mL de solução teste', 'unidade/mL', '0,1–0,5 mcg/kg/min', 'Droga Delta 1 amp + 50 mL', '5 mg/h']], 'tabela-ficticia.pdf');
  await openReader(page, tabela());
  await expect(reader(page).locator('.chr')).toHaveCount(4);
  await reader(page).getByRole('button', { name: 'Selecionar visíveis' }).click();
  await reader(page).getByRole('button', { name: 'Levar 4 trechos' }).click();

  await expect(editor(page).locator('fieldset')).toHaveCount(2);
  await expect(row(page, 0).getByLabel('Medicamento', { exact: true })).toHaveValue('Droga Gama');
  // As linhas sem dose entre dois trechos entram no item, como a unidade da concentração.
  await expect(row(page, 0).getByLabel('Dose e posologia')).toHaveValue('Droga Gama 2 amp + 100 mL de solução teste unidade/mL 0,1–0,5 mcg/kg/min');
  await expect(row(page, 1).getByLabel('Medicamento', { exact: true })).toHaveValue('Droga Delta');
  await expect(row(page, 1).getByLabel('Dose e posologia')).toHaveValue('Droga Delta 1 amp + 50 mL 5 mg/h');
  await editor(page).getByRole('button', { name: 'Cancelar' }).click();

  await openReader(page, tabela());
  await reader(page).getByLabel('Juntar linhas próximas no mesmo medicamento').uncheck();
  await reader(page).getByRole('button', { name: 'Selecionar visíveis' }).click();
  await reader(page).getByRole('button', { name: 'Levar 4 trechos' }).click();
  await expect(editor(page).locator('fieldset')).toHaveCount(4);
});

test('usa o nome filtrado quando o trecho é meio de frase', async ({ page }) => {
  await openReader(page, pdfFicticio([['O texto corrido cita a droga zeta, que se usa assim:', 'manter a droga zeta em 3 mg/h no esquema teste.', 'Droga Zeta Plus 1 mg/kg']]));
  await reader(page).getByLabel('Filtrar trechos').fill('droga zeta');
  await reader(page).getByRole('button', { name: 'Selecionar visíveis' }).click();
  await reader(page).getByRole('button', { name: 'Levar 2 trechos' }).click();
  await expect(row(page, 0).getByLabel('Medicamento', { exact: true })).toHaveValue('Droga zeta');
  // Quando o nome sugerido já contém o termo, ele é mantido.
  await expect(row(page, 1).getByLabel('Medicamento', { exact: true })).toHaveValue('Droga Zeta Plus');
});

test('lê um PDF importado em Arquivos', async ({ page }) => {
  await page.locator('#file').setInputFiles(capitulo());
  await page.locator('[data-commit]').click();
  await menu(page, 'Arquivos').click();
  await page.getByRole('button', { name: 'Extrair doses de manual-ficticio.pdf' }).click();
  await expect(reader(page)).toContainText('3 trechos com dose');
  await page.keyboard.press('Escape');
  await expect(reader(page)).toBeHidden();
});

test('explica quando não consegue ler o PDF', async ({ page }) => {
  await openReader(page, pdfInvalido);
  await expect(reader(page).getByRole('alert')).toHaveText('Não foi possível ler este PDF. O arquivo pode estar corrompido.');

  await reader(page).getByRole('button', { name: 'Escolher outro PDF' }).click();
  await page.locator('#chapter').setInputFiles(pdfFicticio([[]], 'digitalizado.pdf'));
  await expect(reader(page).getByRole('alert')).toContainText('não tem texto selecionável');

  await page.locator('#chapter').setInputFiles(file('nota.txt', '5 mg', 'text/plain'));
  await expect(reader(page).getByRole('alert')).toHaveText('Escolha um arquivo PDF.');
});

test('mostra o texto do PDF como texto, sem virar HTML', async ({ page }) => {
  await openReader(page, pdfFicticio([['<img src=x onerror="window.invadido=true"> 5 mg', '<b>negrito</b> 10 mL']]));
  await expect(trecho(page, '<b>negrito</b>')).toContainText('<img src=x onerror="window.invadido=true">');
  await expect(reader(page).locator('.chr b, .chr img')).toHaveCount(0);
  expect(await page.evaluate(() => window.invadido)).toBeUndefined();
});

test('reconhece doses escritas de formas diferentes e ignora números soltos', async ({ page }) => {
  const doses = ['1 g EV de 8/8 h', '100 UI/kg', '2 mEq/kg', '20 gotas', '0,1 mcg/kg/min', '10-20 mL/kg', 'soro teste 5%', '1,5 mg/kg/dose', '2 comprimidos', '50 µg'];
  const semDose = ['Página 12', 'Tabela 3', 'Publicado em 2024', 'Classe 2A', 'Grupo de 40 pessoas', '3 mgr'];
  const found = await page.evaluate(([a, b]) => [a.filter((t) => !DOSE1.test(t)), b.filter((t) => DOSE1.test(t))], [doses, semDose]);
  expect(found).toEqual([[], []]);
});
