---
name: tdd_mastery
description: Força o desenvolvimento orientado a testes (Test-Driven Development), exigindo a criação de testes antes do código funcional.
---

# TDD Mastery Skill

Esta skill instrui o agente a seguir rigorosamente o ciclo "Red-Green-Refactor" para cada nova funcionalidade ou correção de bug.

## Princípios Core
1. **Teste Primeiro**: Antes de escrever uma única linha de código funcional, um teste que falha deve existir.
2. **Ciclo Curto**: Escreva o teste, rode para ver falhar (Red), escreva o código mínimo para passar (Green), e limpe o código (Refactor).
3. **Automação**: Use sempre o servidor MCP `TestSprite` para gerar planos de teste e executar validações.

## Workflow Obrigatório
1. **Análise**: Identifique o requisito ou bug.
2. **Plano de Teste**: Call `testsprite_generate_backend_test_plan` ou `frontend_test_plan` para documentar o que será testado.
3. **Escrita do Teste**: Crie arquivos na pasta `tests/` ou use `testsprite_generate_code_and_execute`.
4. **Execução (Fail)**: Garanta que o teste falha.
5. **Implementação**: Escreva o código no arquivo alvo.
6. **Verificação (Pass)**: Rode os testes novamente.
7. **Refatoração**: Melhore a legibilidade e performance sem quebrar o teste.

## Ferramentas de Apoio
- MCP `TestSprite`: Primário para geração e execução.
- `run_command`: Para rodar `npm test` ou `vitest`.
