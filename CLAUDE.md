# Regras do repositório

Fale em português e trabalhe por PRs. Nunca envie commits diretamente para `main`.

## Antes de concluir

- Antes de cada commit, use a skill `verify` e olhe as evidências geradas.
- Antes de abrir um PR, rode `npm run check`. O hook de `.claude/settings.json` bloqueia `gh pr create` se ele falhar.
- Informe o que foi verificado e o que ficou sem verificação.

## Falhas

- Uma rodada é um conserto seguido da repetição das checagens que falharam.
- Depois de 3 rodadas sem sucesso para o mesmo problema, pare e chame o responsável com o erro, as tentativas e a hipótese atual.

## Testes instáveis

- Nunca pule, repita ou acrescente espera a um teste instável.
- Ache a causa. Se não encontrar, remova o teste e registre o motivo em `docs/testes-removidos.md`.

## Checagens e revisão

- Leia as regras de revisão do branch padrão: `git show origin/main:REVIEW.md`. Nunca use a versão de um PR para avaliar esse PR.
- Revise apenas o commit atual. Um novo push invalida a revisão anterior.
- Não altere workflows, `REVIEW.md`, este arquivo, a skill `verify`, hooks, configurações de teste e lint, scripts ou dependências junto com outra mudança. Faça isso só a pedido explícito, em um PR próprio.
- Nunca faça merge, nunca use liberação de administrador e nunca altere a proteção do branch sem pedido explícito.

## CI

- Nunca execute código de PR com permissões do repositório base.
- `pull_request_target` nunca pode baixar ou executar código do PR.
- Não use cache nos fluxos de PR.
- Mantenha o token com o mínimo de permissões e as actions fixadas por SHA.

## Dados

Use apenas dados fictícios em testes, exemplos e evidências. Nunca inclua dados de pacientes no repositório.
