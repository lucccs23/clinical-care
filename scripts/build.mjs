import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
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
console.log(`Build concluído: dist/index.html (pdf.js ${JSON.parse(await pdfjs('../package.json')).version})`);
