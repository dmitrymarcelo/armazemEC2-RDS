---
name: security_auditor
description: Verifica automaticamente se o código gerado segue as regras de segurança OWASP antes do commit.
---

# Security Auditor Skill (OWASP Guard)

Esta skill garante que o LogiWMS-Pro mantenha os mais altos padrões de segurança.

## Checklist de Auditoria (OWASP Top 10)
Antes de considerar uma tarefa concluída, o agente deve auditar:

1. **A01: Broken Access Control**: Verifique se as rotas de API têm validação de token (JWT) e se o frontend oculta módulos aos quais o usuário não tem acesso.
2. **A03: Injection**: 
    - No backend: Nunca use concatenação de strings para queries SQL. Utilize sempre queries parametrizadas (ex: `$1, $2`).
    - No frontend: Evite `dangerouslySetInnerHTML` sem sanitização pesada.
3. **A07: Identification and Authentication Failures**: Verifique se as senhas no banco de dados (mesmo local) estão sendo tratadas com cuidado ou se há hardcoded credentials em logs.

## Práticas Obrigatórias
- **Sanitização**: Qualquer input do usuário deve ser tratado.
- **Princípio do Menor Privilégio**: As rotas da API devem retornar apenas os dados necessários.
- **Auditoria de Dependências**: Use `npm audit` periodicamente.

## Workshop de Auditoria Automatizada
O agente deve rodar buscas grep para termos perigosos:
- `eval(`
- `innerHTML`
- `SELECT * FROM ... + variable` (concatenação manual)
- `process.env[...` sem fallback seguro
