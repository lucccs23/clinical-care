# Regras de revisão

Estas regras valem pela versão do branch padrão. Marque cada achado como **Importante**, **Detalhe** ou **Pré-existente**. Um problema pré-existente não bloqueia o autor.

Verifique apenas os itens acionados pelo diff:

| Quando o diff mexe em | Verifique |
|---|---|
| Cálculo de dose ou peso | Unidade, divisão por tomadas, dose mínima e máxima, volume e peso inválido. O peso não pode ser salvo. |
| Leitura de arquivos | Separadores, decimais brasileiros, codificação, arquivos inválidos e limites de tamanho. |
| Renderização de dados importados | Todo conteúdo importado passa por `esc`. Nenhum dado importado vira HTML ou script. |
| Abertura de arquivos | Tipos vêm da lista do app, não do arquivo. HTML e SVG continuam recusados. |
| IndexedDB ou `localStorage` | Migração, recarga, substituição, exclusão e favoritos órfãos. |
| Rede ou dependências no app | O app continua funcionando sem internet e não envia dados para fora. |
| Testes | O teste ainda prova o comportamento. Não há enfraquecimento, pulo, repetição ou espera fixa. |
| Dados de exemplo | São fictícios e não identificam pacientes. |

Peça evidência da skill `verify` para qualquer mudança visível ao usuário.
