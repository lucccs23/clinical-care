import { file } from '../.claude/skills/verify/fixtures.js';

export const cenariosFicticios = (titles = ['Cenário Alfa']) =>
  file(
    'cenarios-ficticios.json',
    JSON.stringify({
      tipo: 'cenarios-prescricao',
      versao: 1,
      cenarios: titles.map((title) => ({
        title,
        note: 'Observação fictícia',
        items: [
          {
            droga: 'Droga Teste',
            apresentacao: 'Frasco teste',
            posologia: '1 unidade fictícia',
            via: 'Oral',
            obs: '',
            ref: 'Livro Teste p.1',
            alts: [{ droga: 'Droga Reserva', posologia: '2 unidades fictícias', obs: 'Se faltar a primeira' }],
          },
        ],
      })),
    }),
    'application/json',
  );

// PDF mínimo com texto em Helvetica: uma lista de linhas por página. Conteúdo sempre fictício.
export function pdfFicticio(pages, name = 'capitulo-ficticio.pdf') {
  // Escapa o que a sintaxe do PDF exige e grava os traços nos códigos do WinAnsi, que o latin1 não tem.
  const text = (value) => value.replace(/[\\()]/g, (char) => '\\' + char).replaceAll('–', '\x96').replaceAll('—', '\x97');
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  const kids = [];
  for (const lines of pages) {
    const stream = `BT /F1 11 Tf 14 TL 56 780 Td ${lines.map((line) => `(${text(line)}) Tj T*`).join(' ')} ET`;
    const content = objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    kids.push(objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(body, 'latin1');
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return file(name, Buffer.from(body, 'latin1'), 'application/pdf');
}
