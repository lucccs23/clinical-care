import { expect, test } from '@playwright/test';
import { allFormats } from '../.claude/skills/verify/fixtures.js';
import { cenariosFicticios, pdfFicticio } from './dados-ficticios.js';

// Mede a tela renderizada: espaços em múltiplos de 4, controles em múltiplos de 8 e linhas na base de 4.
const SPACING = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap'];
const CONTROLS = '.pri,.sec,.icon,.star,.ctl,.chip,.updb,.seg button,.form input,.form select,.stackf input,.side,.ext';

async function offGrid(page) {
  return page.evaluate(
    ({ spacing, controls }) => {
      const px = (value) => (value.endsWith('px') ? parseFloat(value) : 0);
      const name = (el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
      const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
      const centered = (el, prop) =>
        // Margens automáticas centralizam ou empurram blocos e não são espaçamento da grade.
        (el.matches('#view, dialog') && /margin(Left|Right|Top|Bottom)/.test(prop)) ||
        (el.matches('#nav2') && prop === 'marginLeft') ||
        (el.matches('#title') && prop === 'marginRight') ||
        (el.matches('.side, .top') && /padding(Left|Right)/.test(prop));
      const errors = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!visible(el) || el.closest('svg') || el.matches('option')) continue;
        const style = getComputedStyle(el);
        for (const prop of spacing) {
          const value = px(style[prop]);
          if (value % 4 !== 0 && !centered(el, prop)) errors.push(`${name(el)} ${prop}=${style[prop]}`);
        }
        const hasText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
        if (hasText && style.lineHeight !== 'normal' && px(style.lineHeight) % 4 !== 0) errors.push(`${name(el)} lineHeight=${style.lineHeight}`);
        if (hasText && style.lineHeight === 'normal') errors.push(`${name(el)} lineHeight=normal`);
        if (el.matches(controls) && Math.round(el.getBoundingClientRect().height) % 8 !== 0) {
          errors.push(`${name(el)} height=${el.getBoundingClientRect().height}`);
        }
      }
      return [...new Set(errors)];
    },
    { spacing: SPACING, controls: CONTROLS },
  );
}

async function screens(page) {
  const checks = {};
  const side = (name) => page.locator('.side').getByRole('button', { name });
  checks.visao = await offGrid(page);
  for (const name of ['Doses', 'Calculadoras', 'Arquivos']) {
    await side(name).click();
    checks[name] = await offGrid(page);
  }
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('a');
  checks.busca = await offGrid(page);
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('');
  await page.getByRole('button', { name: 'Mais temas' }).click();
  checks.temas = await offGrid(page);
  await page.getByRole('button', { name: 'Fechar' }).click();
  await side('Prescrições').click();
  await page.locator('#view').getByRole('button', { name: 'Novo registro' }).click();
  checks.registro = await offGrid(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: /^Cenário Alfa/ }).click();
  checks.cenario = await offGrid(page);
  await page.getByRole('button', { name: 'Editar' }).click();
  checks.editor = await offGrid(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('#chapter').setInputFiles(pdfFicticio([['Droga Teste', '1 mg/kg EV'], ['Texto sem dose']]));
  await page.getByRole('dialog', { name: 'Ler capítulo' }).locator('.chr input').first().check();
  checks.leitor = await offGrid(page);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  return Object.fromEntries(Object.entries(checks).filter(([, errors]) => errors.length));
}

test('segue a grade de 8 pontos no computador e no celular', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file').setInputFiles([...allFormats, cenariosFicticios()]);
  await expect(page.getByRole('dialog', { name: 'Importar arquivos' })).toBeVisible();
  expect(await offGrid(page)).toEqual([]);
  await page.locator('[data-commit]').click();
  await expect(page.getByRole('dialog', { name: 'Importar arquivos' })).toBeHidden();
  await page.getByLabel('Peso do paciente em quilos').fill('20');

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await screens(page)).toEqual({});
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('.side').getByRole('button', { name: 'Visão geral' }).click();
  expect(await screens(page)).toEqual({});
});
