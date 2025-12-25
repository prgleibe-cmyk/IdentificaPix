
# Checklist de Manutenção do Core Engine

Este documento é obrigatório para qualquer desenvolvedor que deseje alterar a lógica de processamento de dados.

## 1. Antes de Alterar
- [ ] **Identifique o Componente:** A falha é na leitura (`Adapter`), na descoberta de colunas (`Parser`) ou na limpeza do dado (`Resolver`)?
- [ ] **Crie um Teste de Falha:** Antes de corrigir, adicione um `it()` em `coreEngine.test.ts` que falhe com o erro atual.

## 2. Durante a Alteração
- [ ] **Respeite os Especialistas:** Ajustes de data devem ficar APENAS no `DateResolver`.
- [ ] **Sem Efeitos Colaterais:** Funções de limpeza não devem ter estado global ou acessar variáveis de outros arquivos.
- [ ] **Fidelidade ao Original:** Garanta que os dados originais ainda existam no campo `metadata`.

## 3. Após Alterar
- [ ] **Executar QA Local:** Abra a `TestView` no app e garanta que TODA a suíte de testes está verde.
- [ ] **Teste de PDF vs CSV:** Se alterou o PDF, carregue um CSV antigo para garantir que ele continua sendo processado.
- [ ] **Validação de Sinais:** Verifique se as saídas continuam negativas (vermelhas) e entradas positivas.
- [ ] **Regra das 3 Colunas:** Garanta que a exportação final continua gerando apenas Data, Nome e Valor.

---
*Assinado: Equipe de Engenharia IdentificaPix*
