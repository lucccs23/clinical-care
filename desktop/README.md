# Painel de Plantão para Windows

Programa que abre o `dist/index.html` gerado pelo build da raiz, com o pdf.js embutido, em janela própria e sem acesso à internet. `npm start`, `npm test` e `npm run dist` rodam o build antes.

```powershell
npm ci
npm test
npm run dist
```

O instalador fica em `dist/desktop/`, na raiz do repositório. Os dados ficam no perfil do usuário do Windows e continuam lá ao atualizar ou desinstalar o programa.

## Publicar uma atualização

O botão **Buscar atualizações** procura a versão mais recente nas releases públicas deste repositório. Só publique depois do merge no `main`.

```powershell
npm version patch --no-git-tag-version
npm run dist
```

Depois do merge dessa mudança de versão, crie a release `vX.Y.Z` com estes três arquivos de `dist/desktop/`: o instalador, o `.blockmap` e `latest.yml`. Os programas instalados só recebem versões maiores que a sua.

## Dados

Para trazer dados de um navegador, use **Exportar backup** nele e **Restaurar backup** no programa.
