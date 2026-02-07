---
name: agent_manager
description: Organiza o agente para trabalhar em tarefas paralelas ("Loki Mode") e relatar com "Artifacts" para revisão rápida.
---

# Agent Manager Skill (Missão Controle)

Esta skill melhora a eficiência do agente ao lidar com múltiplos fluxos de trabalho simultaneamente.

## Princípios Core
1. **Loki Mode (Paralelismo)**: Use a capacidade de chamar múltiplas ferramentas em um único turno para avançar em frentes diferentes (ex: criar backend e frontend em um único `multi_replace_file_content`).
2. **Documentação por Artefatos**: Todo progresso significativo deve gerar ou atualizar um `walkthrough.md`.
    - Use `implementation_plan.md` para alinhar grandes mudanças.
    - Use `task.md` para checklist granular.
3. **Comunicação Visual**: Sempre que possível, inclua screenshots (`browser_subagent`) e logs de terminal para provar que a implementação funciona.

## Workflow de Missão Controle
1. **Quebra de Tarefa**: Divida grandes pedidos em sub-tarefas no `task.md`.
2. **Execução em Batch**: Agrupe tool calls relacionadas (ex: `write_to_file` + `run_command`).
3. **Checkpoint de Artefato**: Ao terminar um bloco de trabalho, atualize o `walkthrough.md` com o que foi feito.
4. **Relatório de Revisão**: Use `notify_user` com `PathsToReview` para facilitar a vida do usuário.

## Loki Mode em Prática
- Não espere uma ferramenta terminar se outra tarefa independente pode ser iniciada no mesmo turno (exeto se houver dependência direta de arquivos).
