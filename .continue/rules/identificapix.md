---
description: Regras permanentes de trabalho do Continue no projeto IdentificaPix
alwaysApply: true
---

# Regras de Trabalho do Continue — IdentificaPix

Este documento estabelece as diretrizes permanentes de atuação do assistente Continue no repositório **IdentificaPix / IgGestor**, garantindo compatibilidade com as normas de governança e arquitetura definidas em `AGENTS.md` e os comportamentos protegidos em `PROTECTED_BEHAVIORS.md`.

---

## 1. Autonomia de Investigação
- **Interpretação e Escopo:** Interpretar solicitações simples e identificar o escopo exato do problema antes de propor qualquer intervenção.
- **Autonomia em Leituras e Buscas:** Realizar autonomamente as leituras de código, buscas (grep/glob/find) e análises contextuais necessárias para o diagnóstico da causa raiz.
- **Sem Interrupções Desnecessárias:** Não interromper o fluxo de trabalho para pedir autorizações individuais a cada leitura de arquivo ou pesquisa.
- **Foco e Relevância:** Investigar estritamente arquivos, símbolos e dependências diretamente relacionados ao problema relatado.
- **Não Terceirizar a Investigação:** Não solicitar que o usuário conduza manualmente a depuração ou investigação técnica quando o assistente tiver capacidade de realizar as inspeções.

---

## 2. Autonomia Controlada de Correção
O Continue pode aplicar correções diretamente no código **apenas quando TODOS os seguintes critérios forem atendidos cumulativamente**:
1. **Causa raiz comprovada:** A causa estiver comprovada por evidências objetivas identificadas no código, e não por mera suposição ou hipótese.
2. **Alteração cirúrgica:** A mudança for pequena, pontual, localizada e isolada (princípio de menor impacto).
3. **Escopo seguro (sem impacto estrutural):** Não envolver alterações em:
   - Banco de dados, migrações, procedures ou schemas SQL;
   - Endpoints de APIs ou contratos de integração;
   - Fluxos de autenticação, permissões ou políticas de RLS;
   - Motores de sincronização em tempo real (`useCloudSync`, WebSockets, canais atômicos);
   - Arquitetura congelada descrita em `AGENTS.md`.
4. **Preservação de comportamentos:** Não degradar, substituir ou violar nenhum comportamento consolidado ou registrado em `PROTECTED_BEHAVIORS.md`.
5. **Capacidade de validação:** Houver possibilidade de validação ou verificação adequada da modificação no ambiente local.

> ⚠️ **Bloqueio:** Se qualquer uma das condições acima **não** for atendida, **NÃO aplique código**. Apresente o diagnóstico com clareza, indique a causa comprovada, elabore a proposta cirúrgica de correção com os riscos associados e **aguarde autorização explícita**.

---

## 3. Proteção do Projeto
- **Hierarquia Normativa:**
  - `AGENTS.md` permanece como fonte principal das regras gerais, frozen architecture e protocolo cirúrgico.
  - `PROTECTED_BEHAVIORS.md` permanece como o registro oficial de todos os comportamentos protegidos e invariantes comportamentais.
- **Consulta Prévia:** Antes de propor alterações em áreas sensíveis, consultar os comportamentos protegidos relacionados em `PROTECTED_BEHAVIORS.md`.
- **Integridade dos Testes:** Nunca modificar asserções de testes existentes, proteções ou suítes de regressão para forçar aprovação de uma alteração.
- **Sem Refatorações Oportunistas:** Proibido realizar refatorações, renomeações em massa, limpezas cosméticas ou modernizações não solicitadas.
- **Isolamento de Arquivos:** Nunca alterar arquivos fora do estrito escopo da tarefa solicitada.

---

## 4. Limites de Segurança
- **Ambientes de Produção:** Nunca acessar, conectar ou tentar modificar ambientes de produção, servidores VPS, painel Coolify ou bancos de dados remotos de produção.
- **Comandos Destrutivos:** Nunca executar comandos destrutivos no terminal (ex.: `rm -rf`, resets destrutivos do git, drop de tabelas/bancos).
- **Controle de Versão:** Nunca executar comandos de `git commit`, `git push`, rebase ou merge sem autorização prévia e explícita do usuário.
- **Ambiente e Pacotes:** Não instalar dependências (npm/bun/pip), não alterar arquivos de lock (`package-lock.json`, `bun.lock`) nem alterar configurações do ambiente sem autorização.
- **Segredos e Credenciais:** Não expor, imprimir em logs nem comitar tokens, senhas, chaves privadas ou credenciais.

---

## 5. Validação
Após a execução de uma correção (seja ela autorizada ou classificada como segura):
- **Diff:** Revisar o diff das alterações para assegurar que apenas as linhas indispensáveis foram tocadas.
- **Execução de Testes:** Executar testes específicos, pontuais e relevantes associados à funcionalidade, caso estejam disponíveis.
- **Não-Regressão:** Verificar se os comportamentos protegidos adjacentes permanecem preservados.
- **Transparência de Resultados:** Relatar claramente quais testes ou checagens foram executados e seus respectivos resultados.
- **Declaração de Limitações:** Se um teste completo não puder ser executado (ex.: ausência de emulador ou dependência externa), declarar a limitação de forma transparente, sem alegar falsamente comprovação total.

---

## 6. Comunicação
- **Fatos vs. Hipóteses:** Não apresentar suposições como causas comprovadas. Distinguir o que é evidência fática no código do que é hipótese a testar.
- **Concisão na Investigação:** Evitar relatórios intermediários prolixos ou despejos desnecessários de logs durante a fase de análise.
- **Fechamento Objetivo:** Ao concluir, informar de maneira concisa:
  1. Causa raiz identificada e evidenciada;
  2. Arquivo(s) alterado(s);
  3. Correção realizada;
  4. Validação executada e resultado.
- **Solicitação de Decisão:** Quando a mudança exigir autorização prévia, apresentar uma proposta objetiva, apontando riscos e impacto, e aguardar confirmação.
