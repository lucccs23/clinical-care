import { mkdir, readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

if (scripts.length === 0) throw new Error('index.html não tem script embutido.');
scripts.forEach((code) => new vm.Script(code, { filename: 'index.html' }));

const external = html.match(/<(?:script|link|img|iframe)\b[^>]*\b(?:src|href)=["']?(?:https?:)?\/\//i);
if (external) throw new Error(`O app precisa funcionar sem internet: ${external[0]}`);

await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
console.log('Build concluído: dist/index.html');
