import { deflateRawSync } from 'node:zlib';

function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const raw = Buffer.from(content);
    const data = deflateRawSync(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(8, 10);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(raw.length, 24);
    header.writeUInt16LE(nameBytes.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  const count = Object.keys(entries).length;
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export const file = (name, content, mimeType = 'application/octet-stream') => ({
  name,
  mimeType,
  buffer: Buffer.isBuffer(content) ? content : Buffer.from(content),
});

export const doseCsv = (title = 'Droga Fictícia', name = 'doses-teste.csv') =>
  file(
    name,
    Buffer.from(
      `medicamento;indicacao;dose_min_kg;dose_max_kg;dose_maxima;unidade;concentracao;tomadas_dia\n${title};"Uso; teste";10;20,5;300;mg;50;2\n`,
      'latin1',
    ),
    'text/csv',
  );

const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
export const xlsx = file(
  'tabela.xlsx',
  zip({
    'xl/sharedStrings.xml': `<sst ${ns}><si><t>nome</t></si><si><t>dose_kg</t></si><si><t>Teste Planilha</t></si></sst>`,
    'xl/worksheets/sheet1.xml': `<worksheet ${ns}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>0.5</v></c></row></sheetData></worksheet>`,
  }),
);

export const docx = file(
  'protocolo-teste.docx',
  zip({
    'word/document.xml':
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Fluxo fictício</w:t></w:r></w:p><w:p><w:r><w:t>termodocx</w:t></w:r></w:p></w:body></w:document>',
  }),
);

export const txt = file('anotacao.txt', 'nota com termotxt', 'text/plain');
export const md = file('resumo.md', '# Resumo\ntermomd', 'text/markdown');
export const tsv = file('lista.tsv', 'nome\tobs\nItem TSV\ttermotsv\n', 'text/tab-separated-values');
export const json = file('prescricoes.json', '[{"titulo":"Item JSON","obs":"termojson"}]', 'application/json');
export const pdf = file('guia.pdf', '%PDF-1.4\n%%EOF\n', 'application/pdf');
export const png = file(
  'imagem.png',
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
  'image/png',
);

export const allFormats = [doseCsv(), xlsx, docx, txt, md, tsv, json, pdf, png];
