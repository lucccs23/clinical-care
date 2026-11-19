import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, Menu, protocol, session } from 'electron';

const here = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'painel://app';
const HOME = `${ORIGIN}/index.html`;
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'connect-src blob:',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
const FILE_CSP = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'; base-uri 'none'";
const VIEWABLE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain;charset=utf-8']);
const secureWeb = { sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false };

protocol.registerSchemesAsPrivileged([
  { scheme: 'painel', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let mainWindow;
const openFiles = new Map();

const indexPath = () => (app.isPackaged ? join(here, 'app', 'index.html') : join(here, '..', 'index.html'));
const isOwnBlob = (url) => url.startsWith(`blob:${ORIGIN}/`);

function lockDownSession() {
  const current = session.defaultSession;
  current.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (_details, respond) => respond({ cancel: true }),
  );
  const allowed = (permission, origin) =>
    permission === 'clipboard-sanitized-write' && String(origin).startsWith(ORIGIN);
  current.setPermissionCheckHandler((_contents, permission, origin) => allowed(permission, origin));
  current.setPermissionRequestHandler((contents, permission, respond) =>
    respond(allowed(permission, contents.getURL())),
  );
}

function serveApp() {
  protocol.handle('painel', async (request) => {
    const { host, pathname } = new URL(request.url);
    if (host === 'arquivo') {
      const file = openFiles.get(pathname.slice(1));
      if (!file) return new Response('', { status: 404 });
      return new Response(file.bytes, {
        headers: {
          'content-type': file.type,
          'content-security-policy': FILE_CSP,
          'x-content-type-options': 'nosniff',
        },
      });
    }
    if (host !== 'app' || (pathname !== '/' && pathname !== '/index.html')) {
      return new Response('', { status: 404 });
    }
    return new Response(await readFile(indexPath()), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP },
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 420,
    minHeight: 600,
    show: false,
    backgroundColor: '#0c1716',
    icon: join(here, 'build', 'icon.png'),
    webPreferences: secureWeb,
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
  mainWindow.loadURL(HOME);
}

async function openImportedFile(contents, url) {
  const { type, bytes } = await contents.executeJavaScript(
    `fetch(${JSON.stringify(url)}).then((r) => r.blob()).then(async (b) => ({ type: b.type, bytes: new Uint8Array(await b.arrayBuffer()) }))`,
  );
  if (!VIEWABLE.has(type)) throw new Error('Tipo de arquivo não permitido');
  const token = randomUUID();
  openFiles.set(token, { type, bytes });
  const viewer = new BrowserWindow({
    width: 1000,
    height: 800,
    backgroundColor: '#ffffff',
    icon: join(here, 'build', 'icon.png'),
    webPreferences: { ...secureWeb, plugins: true },
  });
  viewer.on('closed', () => openFiles.delete(token));
  await viewer.loadURL(`painel://arquivo/${token}`);
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (url !== HOME && url !== `${ORIGIN}/`) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    if (isOwnBlob(url) && contents.getURL() === HOME) {
      openImportedFile(contents, url).catch(() =>
        dialog.showErrorBox('Não foi possível abrir o arquivo', 'Tente exportá-lo novamente ou importe outra cópia.'),
      );
    }
    return { action: 'deny' };
  });
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    lockDownSession();
    serveApp();
    createWindow();
  });
}
