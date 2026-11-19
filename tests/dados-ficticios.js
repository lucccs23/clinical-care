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
          { droga: 'Droga Teste', apresentacao: 'Frasco teste', posologia: '1 unidade fictícia', via: 'Oral', obs: '', ref: 'Livro Teste p.1' },
        ],
      })),
    }),
    'application/json',
  );
