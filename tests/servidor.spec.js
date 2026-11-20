import { expect, test } from '@playwright/test';

// O servidor local imita o GitHub Pages: só a raiz de dist/, com tipos conhecidos.
test('serve o app e recusa caminhos fora de dist/ ou de tipo desconhecido', async ({ request }) => {
  const app = await request.get('/');
  expect(app.status()).toBe(200);
  expect(app.headers()['content-type']).toContain('text/html');
  for (const path of ['/package.json', '/%2e%2e/package.json', '/desktop/latest.yml', '/scripts/build.mjs', '/nada.png']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});
