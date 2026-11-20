import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import vm from 'node:vm';

const html = await readFile('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

if (scripts.length === 0) throw new Error('index.html não tem script embutido.');
scripts.forEach((code) => new vm.Script(code, { filename: 'index.html' }));

const externalTag = /<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)=["']?(?:https?:)?\/\//i;
const external = html.match(externalTag);
if (external) throw new Error(`O app precisa funcionar sem internet: ${external[0]}`);
if (!html.includes('</body>')) throw new Error('index.html precisa de </body> para receber o leitor de PDF.');

// O pdf.js entra no próprio arquivo e roda na página, sem worker separado e sem rede.
const require = createRequire(import.meta.url);
const pdfjs = (name) => readFile(require.resolve(`pdfjs-dist/build/${name}`), 'utf8');
const [lib, worker] = await Promise.all([pdfjs('pdf.min.mjs'), pdfjs('pdf.worker.min.mjs')]);

const exportList = /export\s*\{([^}]*)\};?\s*$/;
const names = lib.match(exportList);
if (!names) throw new Error('Formato inesperado do pdf.js: falta a lista de exportações.');
const exposed = names[1]
  .split(',')
  .map((entry) => entry.trim().split(/\s+as\s+/))
  .map(([local, name = local]) => `${JSON.stringify(name)}:${local}`)
  .join(',');
const libScript = lib.replace(exportList, () => `globalThis.pdfjsLib=Object.freeze({${exposed}});`);
if (!worker.includes('globalThis.pdfjsWorker=')) throw new Error('Formato inesperado do pdf.js: o worker não se registra.');

for (const [name, code] of [['pdf.js', libScript], ['worker do pdf.js', worker]]) {
  if (/<\/script|<!--/i.test(code)) throw new Error(`O ${name} contém uma sequência que fecharia o script.`);
}

const embedded = `<script type="module">${worker}</script>\n<script type="module">${libScript}</script>\n`;
const output = html.replace('</body>', () => `${embedded}</body>`);

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', output);

// Arquivos para instalar no celular (manifesto, ícones e service worker), quando existirem.
// A versão do cache do service worker muda sempre que algum arquivo publicado muda.
const PWA_TYPES = { '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const pwa = existsSync('pwa') ? (await readdir('pwa')).sort() : [];
const unknown = pwa.filter((name) => !PWA_TYPES[extname(name)]);
if (unknown.length) throw new Error(`Tipo não permitido em pwa/: ${unknown.join(', ')}`);
const files = await Promise.all(pwa.map(async (name) => [name, await readFile(join('pwa', name))]));
const version = createHash('sha256').update(output);
files.forEach(([name, data]) => version.update(name).update(data));
for (const [name, data] of files) {
  const text = extname(name) === '.png' ? null : data.toString('utf8');
  if (text && /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(text.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ''))) {
    throw new Error(`O app precisa funcionar sem internet: pwa/${name} cita um endereço externo.`);
  }
  await writeFile(join('dist', name), text ? text.replaceAll('__VERSAO__', version.copy().digest('hex').slice(0, 12)) : data);
}
console.log(`Build concluído: dist/index.html${pwa.length ? ` e ${pwa.length} arquivos de pwa/` : ''} (pdf.js ${JSON.parse(await pdfjs('../package.json')).version})`);
