---
name: verify
description: Sobe o Painel de Plantão e testa as funções principais de ponta a ponta em um navegador real, como um usuário. Use antes de cada commit e antes de abrir um PR.
---

# Verificar o Painel de Plantão

Rodar o app é a prova principal. Não declare uma mudança pronta sem esta verificação.

## Passos

1. Na primeira execução, instale o necessário:

   ```powershell
   npm ci
   npx playwright install chromium
   ```

2. Rode os fluxos. O comando gera o build, sobe o app em `127.0.0.1:4173` e abre o Chromium:

   ```powershell
   npm run verify
   ```

3. Abra e olhe as imagens em `test-results/verify-evidencias/`. Procure texto cortado, sobreposição e tela vazia.

4. Se a mudança criou um comportamento que os fluxos não cobrem, adicione um teste em `tests/` e exercite esse comportamento.

5. Informe o que rodou, o resultado e o que ficou sem verificação.

## O que os fluxos cobrem

- Importação por seletor e por arrastar, em todos os formatos aceitos.
- Recusa de arquivos inválidos e exibição segura de conteúdo importado.
- Busca, cálculo por peso, limite de dose e peso não salvo.
- Favoritos e arquivos após recarregar, inclusive abrindo por `file://`.
- Substituição, exclusão, troca de categoria, abertura e download de arquivos.
- Cópia, modelo de doses, calculadoras, tema e layout de celular.
- Ausência de erros de página e de requisições externas.

## Regras

- Use apenas dados fictícios.
- Se falhar, ache a causa. Uma rodada é um conserto seguido da repetição das checagens. Depois de 3 rodadas sem sucesso, pare e chame o responsável.
- Nunca pule, repita ou acrescente espera a um teste instável. Sem causa encontrada, remova o teste e registre o motivo em `docs/testes-removidos.md`.
