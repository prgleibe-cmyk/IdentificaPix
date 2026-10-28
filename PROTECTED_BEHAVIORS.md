# REGISTRO CENTRAL DE COMPORTAMENTOS PROTEGIDOS (PROTECTED BEHAVIORS)
**Projeto:** IgGestor / IdentificaPix  
**Fonte da Verdade:** `/PROTECTED_BEHAVIORS.md`  
**Data de Criação:** 28 de Outubro de 2026  
**Status do Protocolo:** ATIVO E VIGENTE  

---

## 1. Princípio Fundamental
Este registro formaliza o **Protocolo Permanente de Desenvolvimento Seguro e Proteção Contra Regressões**.

* **Diferenciação Crítica:** Código pode ser refatorado, otimizado e reestruturado; **COMPORTAMENTOS APROVADOS e suas INVARIANTES são protegidos contra regressão**.
* **Regra Inegociável:** Nenhum novo ajuste pode ser considerado concluído se introduzir regressão em um comportamento anteriormente protegido.
* **Fluxo de Aprovação Humana:** Novas PBs são registradas **somente** após a confirmação explícita do usuário: `"TESTADO E APROVADO"`. Candidatos a proteção não são considerados homologados sem esse aval explícito.
* **Distinção entre Harness de Infraestrutura e Testes Específicos de PB:**
  - O arquivo `tests/regression/harness.test.ts` valida a integridade geral do protocolo, contratos estruturais e mecanismos base de teste.
  - Ele **NÃO** deve ser usado isoladamente como evidência de que um comportamento `PB-XXX` específico está protegido.
  - Um harness genérico passando não significa que todas as PBs estão protegidas.
  - Cada PB exige **rastreabilidade objetiva**:
    `PB-XXX → Comportamento aprovado → Invariantes específicas → Teste(s)/verificação(ões) correspondente(s) → Resultado da execução`.

---

## 2. Gate Obrigatório de Não-Regressão e Fluxo Pós-Aprovação Completo
Todas as alterações futuras e o ciclo de homologação de novas PBs devem seguir rigorosamente o fluxo:

```text
1. ALTERAÇÃO SOLICITADA
       ↓
2. CONSULTA AO PROTECTED_BEHAVIORS.MD (Mapeamento de impacto em PBs existentes)
       ↓
3. IMPLEMENTAÇÃO CIRÚRGICA (Menor impacto, preservação das invariantes)
       ↓
4. VALIDAÇÃO DO NOVO REQUISITO
       ↓
5. VERIFICAÇÃO DOS COMPORTAMENTOS PROTEGIDOS & SUÍTE DE REGRESSÃO
       ↓
6. APROVAÇÃO TÉCNICA (lint, type-check, testes executáveis)
       ↓
7. ENTREGA PARA TESTE DO USUÁRIO
       ↓
8. CONFIRMAÇÃO DO USUÁRIO ("TESTADO E APROVADO")
       ↓
9. REGISTRO / ATUALIZAÇÃO FORMAL DA PB-XXX (Metadados e invariantes)
       ↓
10. CRIAÇÃO OU ATUALIZAÇÃO DAS PROTEÇÕES TÉCNICAS ESPECÍFICAS
       ↓
11. EXECUÇÃO DOS TESTES ESPECÍFICOS DA NOVA PB
       ↓
12. EXECUÇÃO DO GATE DE REGRESSÃO RELEVANTE (`npm run test:regression`)
       ↓
13. LINT / VALIDAÇÃO ESTÁTICA (`npm run lint`)
       ↓
14. CONFIRMAÇÃO DE QUE AS PROTEÇÕES ANTERIORES CONTINUAM VÁLIDAS
       ↓
15. DECLARAÇÃO FORMAL DO STATUS DA PB:
     • PROTEGIDA (se todas as verificações passaram)
     • PROTEÇÃO PARCIAL (se houver dependência manual ou cobertura incompleta)
     • NÃO PROTEGIDA (se falhar verificação ou sem mecanismo confiável)
```

Se qualquer verificação técnica falhar, a PB **NÃO** receberá status de proteção completa.

---

## 3. Status de Proteção e Estrutura Padrão de PB

### 3.1 Definições Formais de Status
Nunca declare status `PROTEGIDA` apenas porque a PB foi documentada:

* **PROTEGIDA:** Invariantes relevantes possuem proteção técnica adequada (testes executáveis específicos) e todas as verificações (testes específicos, gate geral, lint, não-regressão de PBs anteriores) foram concluídas com sucesso.
* **PROTEÇÃO PARCIAL:** Parte importante do comportamento ainda depende de validação manual, ou a cobertura técnica é incompleta para a totalidade das invariantes.
* **NÃO PROTEGIDA:** Não existe mecanismo técnico confiável suficiente para declarar proteção, ou uma verificação automatizada falhou.

### 3.2 Estrutura Padrão de Registro de PB
Cada entrada homologada deve seguir obrigatoriamente a estrutura:

```markdown
### [PB-XXX] Título do Comportamento
- **ID:** PB-XXX (Sequencial, único, nunca reutilizado)
- **Status da Proteção:** PROTEGIDA | PROTEÇÃO PARCIAL | NÃO PROTEGIDA
- **Data de Aprovação:** AAAA-MM-DD
- **Problema Originalmente Corrigido:** Descrição clara da falha original.
- **Comportamento Aprovado:** Descrição do funcionamento correto esperado.
- **Invariantes Obrigatórias:** Condições e regras lógicas que nunca podem ser violadas.
- **Rastreabilidade Técnica:**
  - `PB-XXX` → Comportamento → Invariantes → Teste específico → Resultado
- **Arquivos Relacionados:** Caminhos absolutos dos arquivos envolvidos.
- **Funções / Componentes Relacionados:** Funções, hooks e componentes específicos.
- **Endpoints & Banco de Dados:** Rotas de API, queries, triggers e tabelas relacionadas.
- **Serviços Externos & Dependências:** Bibliotecas e integrações envolvidas.
- **Testes Responsáveis:** Caminho do(s) teste(s) executável(is) específico(s) da PB.
- **Pontos Críticos de Regressão:** Áreas com risco de quebra colateral.
- **Observações de Manutenção:** Recomendações para desenvolvedores futuros.
```

---

## 4. Registro de Comportamentos Protegidos Homologados

*Nenhum comportamento formalmente homologado como PB sob este protocolo ainda.*  
*(Conforme a Seção 17 do Protocolo, comportamentos são registrados progressivamente após teste e aprovação explícita pelo usuário com a declaração "TESTADO E APROVADO").*

---

## 5. Candidatos a Proteção (Aguardando Aprovação Formal)

Os itens abaixo representam funcionalidades críticas e estabilizadas identificadas no sistema que se beneficiarão de registro como PB assim que forem formalmente homologadas pelo usuário:

### [CANDIDATO-01] Lançamento Manual com Persistência Imediata no Relatório Ativo
- **Contexto:** Lançamento avulso de receitas ou despesas com inserção atômica na VPS (`consolidated_transactions`) e atualização imediata do cache do relatório ativo sem recarregar ou perder itens existentes.
- **Invariantes Principais:**
  1. `onAfterAction` deve ser invocado de forma síncrona com a lista atualizada de transações.
  2. Substituição do ID temporário (`ghost-manual-...`) pelo UUID definitivo do banco sem duplicações.
  3. Reconstrução imediata do mapa de resultados no relatório (`needsFullRebuild`) quando um novo ID é detectado.

### [CANDIDATO-02] Leitura Resiliente de Documentos de Despesa (PDF Digital + OCR Óptico)
- **Contexto:** Upload de faturas, boletos, recibos e notas fiscais no modal de Lançamento Manual.
- **Invariantes Principais:**
  1. O `ArrayBuffer` de PDFs deve ser clonado antes da transferência para o worker do PDF.js para prevenir erros de buffer desanexado (`detached ArrayBuffer`).
  2. Falhas parciais de leitura textual (OCR óptico ou PDF escaneado) não devem abortar a criação do anexo nem impedir o preenchimento manual do lançamento.
  3. Preenchimento de dados textuais deve respeitar e não sobrescrever campos já editados manualmente pelo usuário.

### [CANDIDATO-03] Rolagem Universal por Toque (Touch Scrolling & Gestos)
- **Contexto:** Navegação e rolagem suave em dispositivos móveis e telas touch.
- **Invariantes Principais:**
  1. O motor de arrasto por mouse (`useGlobalDragScroll`) nunca deve interceptar ponteiros de toque (`pointerType === 'touch'` ou `'pen'`).
  2. O CSS deve sempre manter `-webkit-overflow-scrolling: touch` e `touch-action: pan-x pan-y pinch-zoom`.

### [CANDIDATO-04] Otimização de Memória & Lazy Loading de Telas
- **Contexto:** Prevenção de crashes por exaustão de memória no navegador móvel.
- **Invariantes Principais:**
  1. Proibido pré-carregamento concorrente de todas as visualizações (`preloadAllViews`).
  2. Carregamento sob demanda com Suspense e fronteiras de erro.

### [CANDIDATO-05] Paginação Padrão em Relatórios e Gestão Financeira
- **Contexto:** Renderização fluida de tabelas e listas extensas.
- **Invariantes Principais:**
  1. As telas de Relatórios, Livro Caixa e Cadastros mantêm paginação padrão (50 itens por página).
  2. Totais agregados e exportações (PDF/Excel) continuam operando sobre a totalidade dos dados filtrados, nunca apenas sobre a página visível.

### [CANDIDATO-06] Persistência em Tempo Real, Anti-Ressurreição & Isolamento por Congregação
- **Contexto:** Isolamento estrito de dados entre usuários proprietários e congregações de usuários secundários.
- **Invariantes Principais:**
  1. Banco de dados central na nuvem é a única fonte da verdade em tempo real.
  2. Proibida a ressurreição de transações apagadas via caches locais residuais.
  3. Filtragem restrita de congregações autorizadas para usuários secundários em backend e frontend.

### [CANDIDATO-07] Sincronização Bidirecional de Cadastros (Sistema Principal vs. Portal)
- **Contexto:** Atualização em tempo real de membros e contribuintes entre o painel e o portal público.
- **Invariantes Principais:**
  1. Persistência de redundância dupla (`SmartPool` com PostgreSQL e SQLite local fallback).
  2. Evento `contributor_updated` sincroniza as duas interfaces sem requerer refresh de página.

---

## 6. Procedimento para Conflitos com Comportamentos Protegidos
Se uma futura solicitação de ajuste entrar em conflito direto ou aparente com uma PB registrada:

1. **PARE** imediatamente a implementação.
2. Apresente formalmente o relatório de conflito no formato:
   ```text
   CONFLITO COM PROTEÇÃO: [PB-XXX]
   COMPORTAMENTO ATUALMENTE PROTEGIDO: [...]
   NOVA SOLICITAÇÃO: [...]
   MOTIVO DO CONFLITO: [...]
   IMPACTO: [...]
   ALTERNATIVAS SEGURAS: [...]
   ```
3. Aguarde autorização explícita do usuário antes de realizar qualquer alteração que modifique ou substitua o comportamento protegido.
