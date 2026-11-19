import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import { file, txt } from '../../.claude/skills/verify/fixtures.js';
import { pdfFicticio } from '../../tests/dados-ficticios.js';

const { version } = JSON.parse(await readFile(join(import.meta.dirname, '..', 'package.json'), 'utf8'));

let profile;
let app;
let page;
let errors;

async function launch() {
  app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], cwd: join(import.meta.dirname, '..') });
  page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('heading', { name: 'Biblioteca clínica' })).toBeVisible();
}

async function importFiles(files) {
  await page.locator('#file').setInputFiles(files);
  await page.locator('[data-commit]').click();
  await expect(page.getByRole('dialog', { name: 'Importar arquivos' })).toBeHidden();
}

const menu = (name) => page.locator('.side').getByRole('button', { name });

test.beforeEach(async () => {
  errors = [];
  profile = await mkdtemp(join(tmpdir(), 'painel-teste-'));
  await launch();
});

test.afterEach(async () => {
  await app.close();
  await rm(profile, { recursive: true, force: true });
  expect(errors).toEqual([]);
});

test('abre em janela própria e mantém os dados ao reabrir', async () => {
  await expect(page).toHaveTitle('Painel de Plantão');
  expect(page.url()).toBe('painel://app/index.html');
  await page.screenshot({ path: 'test-results/evidencias/app-inicio.png' });

  await importFiles([txt]);
  await page.getByLabel('Peso do paciente em quilos').fill('20');
  await app.close();
  await launch();

  await expect(page.getByLabel('Peso do paciente em quilos')).toHaveValue('');
  await menu('Outros').click();
  await expect(page.getByRole('heading', { name: 'anotacao', exact: true })).toBeVisible();
});

test('não dá acesso ao sistema nem à internet', async () => {
  const result = await page.evaluate(async () => {
    const blocked = await fetch('https://example.com/').then(
      () => false,
      () => true,
    );
    return { blocked, node: typeof require, process: typeof process, popup: window.open('https://example.com/') };
  });
  expect(result).toEqual({ blocked: true, node: 'undefined', process: 'undefined', popup: null });

  // A navegação cancelada deixa o Playwright aguardando a página, então a prova vem do processo principal.
  const navigation = await app.evaluate(({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    return new Promise((resolve) => {
      contents.once('will-navigate', (event, url) => {
        setImmediate(async () =>
          resolve({
            url,
            prevented: event.defaultPrevented,
            current: contents.getURL(),
            title: await contents.executeJavaScript('document.title'),
          }),
        );
      });
      contents.executeJavaScript("location.href = 'https://example.com/'; 0");
    });
  });
  expect(navigation).toEqual({
    url: 'https://example.com/',
    prevented: true,
    current: 'painel://app/index.html',
    title: 'Painel de Plantão',
  });
  expect(app.windows()).toHaveLength(1);
});

test('abre arquivos em janela separada, sem acesso ao sistema', async () => {
  const realPdf = await app.evaluate(async ({ BrowserWindow }) => {
    const bytes = await BrowserWindow.getAllWindows()[0].webContents.printToPDF({});
    return bytes.toString('base64');
  });
  await importFiles([txt, file('guia.pdf', Buffer.from(realPdf, 'base64'), 'application/pdf')]);
  await menu('Arquivos').click();

  const textWindow = app.waitForEvent('window');
  await page.getByRole('button', { name: 'Abrir anotacao.txt' }).click();
  const opened = await textWindow;
  await expect(opened.locator('body')).toContainText('nota com termotxt');
  expect(await opened.evaluate(() => typeof require)).toBe('undefined');
  await opened.close();

  const pdfWindow = app.waitForEvent('window');
  await page.getByRole('button', { name: 'Abrir guia.pdf' }).click();
  const openedPdf = await pdfWindow;
  expect(openedPdf.url()).toMatch(/^painel:\/\/arquivo\//);
  await openedPdf.waitForLoadState();
  const type = await app.evaluate(async ({ BrowserWindow }) => {
    const viewer = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().startsWith('painel://arquivo/'));
    return viewer.webContents.executeJavaScript('document.contentType');
  });
  expect(type).toBe('application/pdf');
});

test('conduz a atualização pelo botão, sem expor o sistema à página', async () => {
  expect(await page.evaluate(() => Object.keys(window.painelApp).sort())).toEqual([
    'check',
    'download',
    'info',
    'install',
    'onState',
  ]);
  await page.getByRole('button', { name: 'Buscar atualizações' }).click();
  const dialog = page.getByRole('dialog', { name: 'Atualizações' });
  await expect(dialog).toContainText(`Versão instalada: ${version}`);
  await dialog.getByRole('button', { name: 'Buscar agora' }).click();
  await expect(dialog).toContainText('Disponível apenas no programa instalado');

  await app.evaluate(({ ipcMain, BrowserWindow }) => {
    const send = (state) => BrowserWindow.getAllWindows()[0].webContents.send('update:state', state);
    globalThis.calls = [];
    for (const [channel, state] of [
      ['update:check', { status: 'available', version: '9.9.9' }],
      ['update:download', { status: 'ready', version: '9.9.9' }],
    ]) {
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, () => send(state));
    }
    ipcMain.removeHandler('update:install');
    ipcMain.handle('update:install', () => globalThis.calls.push('install'));
    globalThis.sendUpdate = send;
  });
  await dialog.getByRole('button', { name: 'Buscar agora' }).click();
  await expect(dialog).toContainText('Versão 9.9.9 disponível');
  await app.evaluate(() => globalThis.sendUpdate({ status: 'error' }));
  await expect(dialog).toContainText('Não foi possível concluir');
  await app.evaluate(() => globalThis.sendUpdate({ status: 'downloading', percent: 40 }));
  await expect(dialog).toContainText('Baixando: 40%');
  await app.evaluate(() => globalThis.sendUpdate({ status: 'available', version: '9.9.9' }));
  await dialog.getByRole('button', { name: 'Baixar atualização' }).click();
  await dialog.getByRole('button', { name: 'Reiniciar e instalar' }).click();
  expect(await page.evaluate(() => window.painelApp.info().then((info) => info.version))).toBe(version);
  expect(await app.evaluate(() => globalThis.calls)).toEqual(['install']);
});

test('copia resultado e salva o backup', async () => {
  const target = test.info().outputPath('backup.json');
  await importFiles([txt]);
  await app.evaluate(({ session }, path) => {
    globalThis.savedBackup = new Promise((resolve) => {
      session.defaultSession.once('will-download', (_event, item) => {
        item.setSavePath(path);
        item.once('done', (_done, state) => resolve(state));
      });
    });
  }, target);

  const previous = await app.evaluate(({ clipboard }) => clipboard.readText());
  await menu('Calculadoras').click();
  await page.locator('#c-imc').getByLabel('Peso (kg)').fill('70');
  await page.locator('#c-imc').getByLabel('Altura (cm)').fill('175');
  await page.getByRole('button', { name: 'Copiar resultado de IMC' }).click();
  await expect(page.locator('#toast')).toHaveText('Copiado');
  const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
  await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), previous);
  expect(copied).toBe('IMC: 22,9 kg/m²');

  await menu('Arquivos').click();
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  await expect(page.locator('#toast')).toHaveText('Backup exportado');
  expect(await app.evaluate(() => globalThis.savedBackup)).toBe('completed');
  expect(JSON.parse(await readFile(target, 'utf8')).files[0].name).toBe('anotacao.txt');
});

test('lê o texto de PDFs com o pdf.js embutido, dentro da política de segurança do programa', async () => {
  const { buffer } = pdfFicticio([['Texto fictício do programa 5 mg']]);
  const text = await page.evaluate(async (bytes) => {
    // O pdf.js roda como módulo: o título pode aparecer antes dele, mas DOMContentLoaded só vem depois.
    if (document.readyState === 'loading') await new Promise((done) => document.addEventListener('DOMContentLoaded', done, { once: true }));
    const task = globalThis.pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
    const content = await (await (await task.promise).getPage(1)).getTextContent();
    await task.destroy();
    return content.items.map((item) => item.str).join('');
  }, [...buffer]);
  expect(text).toBe('Texto fictício do programa 5 mg');
});
