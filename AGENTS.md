# IDENTIFICAPIX - Frozen Architecture Documentation

## Core Architectural Principle
The architecture of IdentificaPix is currently **STABILIZED and FROZEN**. It utilizes an incremental, atomic, and realtime-first strategy to maintain consistency across multiple users and prevent data regressions.

### 🛡️ Frozen Components (DO NOT REFACTOR)

1.  **Incremental Synchronization (useCloudSync)**:
    *   **Atomic Hydration**: Sessions are reconstructed by fetching individual records from `consolidated_transactions` and `learned_associations`, rather than loading a massive JSON blob.
    *   **BLOCK_REGRESSION**: A strictly enforced timestamp-based guard that prevents old data from the database (arriving via realtime or hydration) from overwriting more recent local state.
    *   **UPDATE_INSTEAD_REMOVE**: In the "Live List" context, items are never removed from the local state array during realtime `DELETE` events; instead, they are reverted to a `pending` status to maintain UI stability.
    *   **PostReconstruct Protections**: A complex stabilization logic with a signature-based throttle to prevent re-processing storms during hydration or atomic updates.

2.  **Realtime Infrastructure**:
    *   **Atomic Channels**: Multiple specific channels (`reconciliation-atom-sync`, `realtime-viva`, `reference-realtime`, `sync-granular`) handle specific domain updates to minimize payload size and conflict surface.
    *   **Broadcast Sync**: Used in `AppContext` for granular, non-persisted communication (like "transaction_updated" notifications) that triggers lightweight reconciliation checks.

3.  **AutoProcess Incremental Flow**:
    *   Auto-identification of transactions uses a deferred, stable-signature-based trigger. It must **NOT** be converted into a global, broad-spectrum re-processor.

4.  **UI & Performance**:
    *   **Virtualization**: The list rendering is optimized for high-volume transactions and relies on the stability of the `matchResults` array structure.
    *   **Multi-user Synchronization**: The system is designed to allow multiple users to work on the same dataset simultaneously, relying on atomic updates and the regression guards mentioned above.

## 🚫 Prohibited Actions

*   **No Total Reconstruction**: Do not replace the incremental hydration with a "reset-all" pattern.
*   **No Global AutoProcess**: Do not trigger `handleCompare` globally on every minor state change.
*   **No Structural Refactoring**: Do not merge the specialized realtime channels into a single "god" channel.
*   **No Property Removal**: Do not remove `updatedAt`, `id`, or status fields used by the `BLOCK_REGRESSION` and `PostReconstruct` logic.

## ✅ Permitted Modifications

*   Fixing specific, reproducible bugs.
*   Adding new, independent features that do not conflict with the core synchronization logic.
*   Performance improvements that have been benchmarked and do not alter the atomic/incremental nature of the sync.

---

# PROTOCOLO DE AJUSTES CIRÚRGICOS E REGRA PERMANENTE DE DESENVOLVIMENTO — I G G E S T O R

Esta regra é **OBRIGATÓRIA E PERMANENTE** para toda e qualquer alteração no IgGestor.

### 1. PRINCÍPIO: UMA ALTERAÇÃO POR VEZ
* Execute somente o ajuste solicitado.
* Não aproveite a tarefa para refatorar, reorganizar, modernizar, limpar ou alterar outros códigos.
* Não altere arquivos que não sejam indispensáveis para o ajuste.
* Não crie lógica paralela, duplicada, provisória ou alternativa.
* Quanto menor a alteração necessária, melhor.

### 2. PROTEÇÃO ABSOLUTA DO QUE JÁ FUNCIONA
Antes de alterar qualquer código, identifique quais funcionalidades existentes dependem daquele trecho.
**Tudo que já funciona deve ser considerado PROTEGIDO.**
Um novo ajuste **NÃO pode modificar, degradar ou substituir** comportamentos anteriormente corrigidos, mesmo que estejam em arquivos relacionados.
Correção nova ≠ autorização para modificar correções antigas.

### 3. ALTERAÇÃO CIRÚRGICA
Sempre escolher a solução de **menor impacto possível**:
* menor número de arquivos;
* menor número de linhas;
* menor alteração de lógica;
* menor superfície de risco.
Se for possível corrigir em 1 arquivo, não alterar 2.
Se for possível corrigir em 5 linhas, não reescrever o arquivo inteiro.

### 4. NÃO FAZER EFEITO DOMINÓ
É PROIBIDO alterar outros comportamentos apenas porque estão próximos, relacionados ou podem ser "melhorados".
Não modificar funcionalidades já resolvidas para acomodar uma nova correção sem autorização explícita.
Se a solução exigir impacto maior que o estritamente necessário, **PARE e apresente o diagnóstico antes de alterar.**

### 5. DIAGNÓSTICO ANTES DO CÓDIGO
Antes de editar:
1. localizar a causa exata;
2. identificar o arquivo/trecho responsável;
3. confirmar que a alteração proposta resolve o problema;
4. verificar o que precisa permanecer intacto.
**Não alterar código por hipótese.**
Se a causa não estiver comprovada, não inventar correção. Informar a evidência encontrada.

### 6. PRESERVAÇÃO PERMANENTE
Toda correção concluída deve ser tratada como **REGRA PROTEGIDA**.
Alterações futuras devem preservar essas correções automaticamente.
Uma nova tarefa não revoga uma correção anterior.
Somente alterar uma funcionalidade já protegida se o usuário autorizar **explicitamente** essa alteração.

### 7. ECONOMIA DE TOKENS
Trabalhar de forma objetiva e cirúrgica:
* pesquisar somente o necessário;
* analisar somente os arquivos/trechos envolvidos;
* evitar auditorias amplas sem necessidade;
* evitar reescrever arquivos inteiros;
* não gerar explicações extensas quando uma confirmação objetiva for suficiente.

### 8. TESTE E GATE
Após a alteração:
* verificar a funcionalidade corrigida;
* verificar que as funcionalidades diretamente protegidas não foram afetadas;
* informar exatamente quais arquivos foram alterados;
* informar resumidamente o que foi alterado;
* informar se houve algum impacto adicional.

Classificar o resultado como:
* **APROVADO** — correção concluída sem regressão identificada.
* **APROVADO COM RESSALVAS** — correção concluída, mas existe alguma limitação ou risco identificado.
* **NÃO APROVADO** — não realizar deploy/considerar concluído se houver regressão ou causa não comprovada.

### REGRA FINAL
**O IgGestor deve evoluir por alterações pequenas, isoladas, comprovadas e permanentes — nunca por efeito dominó.**
Se uma alteração puder ser feita de duas formas, escolher a que **mexe menos no sistema e preserva mais código existente**.

* **NÃO EXPANDA O ESCOPO DA TAREFA.**
* **NÃO REABRA PROBLEMAS JÁ RESOLVIDOS.**
* **NÃO ALTERE FUNCIONALIDADES PROTEGIDAS SEM AUTORIZAÇÃO EXPLÍCITA.**
* **UMA SOLICITAÇÃO = UMA ALTERAÇÃO CIRÚRGICA.**

---

# 🛡️ REGISTRO DE FUNCIONALIDADES CONSOLIDADAS E BLINDADAS

As seguintes funcionalidades e diretrizes foram validadas e estão **RIGOROSAMENTE BLINDADAS**:

### 1. Rolagem Universal por Toque (Touch Scrolling & Swipe)
- **Comportamento**: A rolagem por toque e gesto de deslizar o dedo em qualquer lugar da tela (inclusive sobre tabelas, cards, relatórios e modais) deve funcionar de forma 100% nativa, suave e sem travas em smartphones, tablets e telas sensíveis ao toque.
- **Regra**: O motor de arrasto por mouse (`useGlobalDragScroll`) NUNCA deve interceptar ou bloquear ponteiros de toque (`pointerType === 'touch'` ou `'pen'`). O CSS deve sempre manter `-webkit-overflow-scrolling: touch` e `touch-action: pan-x pan-y pinch-zoom` em todos os containers roláveis.

### 2. Otimização de Memória & Inicialização (Prevenção de Quedas do Navegador)
- **Comportamento**: A inicialização do sistema e a navegação entre rotas devem ser leves para evitar esgotamento de memória (*Out of Memory*) e quedas de página.
- **Regra**: Proibido executar pré-carregamento agressivo e concorrente de todas as 17 visualizações no startup (`preloadAllViews`). As visualizações devem ser carregadas sob demanda (*Lazy Loading*) via Suspense com tratamento de erro seguro.

### 3. Paginação Padrão em Relatórios e Gestão Financeira
- **Comportamento**: As telas de Relatórios (`RelatoriosView`), Livro Caixa (`LivroCaixaView`), Cadastros (`ContributorsReportSection`) e Gestão Financeira (`FinancialView`) utilizam paginação (50 itens por página) para garantir fluidez e evitar renderização excessiva no DOM.
- **Regra**: Proibido remover a paginação ou voltar a renderizar listas infinitas sem virtualização ou paginação. Os cálculos de totais e exportações devem sempre continuar considerando todos os registros filtrados.

### 4. Isolamento de Event Listeners & Prevenção de Memory Leaks
- **Comportamento**: Listeners de eventos globais (ex: atualizações de status de recibo WhatsApp) devem ser gerenciados centralmente no componente de tabela/container e repassados via props/mapa.
- **Regra**: Proibido adicionar múltiplos listeners duplicados em nível de linha/cartão individual dentro de loops `map()`.

### 5. Otimização de Troca de Período e Mês em Relatórios
- **Comportamento**: A alternância de mês ou período personalizado em relatórios deve ser instantânea, sem travar a thread principal do navegador nem acionar spinners globais de desmonte de DOM (`setIsLoading(true)` desnecessário).
- **Regra**: O cálculo de filtros de datas e agregação de resumos deve utilizar comparações diretas de strings ISO e indexação O(1) via `Map`, evitando criação de milhares de instâncias `new Date()` em loops ou buscas aninhadas O(N*M).

### 6. Persistência em Tempo Real, Anti-Ressurreição & Isolamento Absoluto de Usuários
- **Comportamento**: O banco de dados central na nuvem é a única fonte da verdade em tempo real. É estritamente proibido haver ressurreição de dados antigos através de caches locais do navegador (localStorage ou IndexedDB) e proibido qualquer vazamento de lançamentos entre contas ou entre usuários secundários de congregações diferentes.
- **Regra**: 
  1. Na hidratação da sessão ativa (`useCloudSync`), a reconstrução deve ser populada estritamente com os registros autênticos retornados do banco (`reconstructed`), nunca mesclando itens antigos/estranhos do cache anterior do navegador.
  2. O sufixo de armazenamento local e IndexedDB (`userSuffix`) deve ser estritamente isolado pelo `user.id` físico autenticado, nunca compartilhado entre usuários secundários ou proprietário.
  3. No logout, tanto o `localStorage` quanto o `IndexedDB` (`idb-keyval`) devem ser limpos imediatamente.
  4. Lançamentos manuais devem sempre gravar o `church_id` e transações de usuários secundários no backend e frontend são estritamente filtradas pelas congregações permitidas do usuário, impedindo retorno de itens não atribuídos ou de outras filiais.

### 7. Sincronização e Coerência Bidirecional de Cadastros (Sistema Principal vs. Portal do Contribuinte)
- **Comportamento**: Os cadastros de contribuintes e suas fotos/mídias devem persistir e sincronizar bidirecionalmente em tempo real entre a lista de cadastros do sistema e o Portal do Contribuinte.
- **Regra**:
  1. O motor de persistência de `contributors-api` utiliza o `SmartPool` com mecanismo de dupla camada (PostgreSQL quando acessível, e motor SQLite local persistente em `data/contributors_local.sqlite` com espelhamento mútuo e redundância total), garantindo persistência sem perda de dados e sem falhas 500 por instabilidade de rede.
  2. O body-parser do backend aceita payloads de imagens e base64 de até 50MB (`express.json({ limit: '50mb' })`).
  3. Salvar no Portal invalida o cache singleton (`invalidateContributorsCache()`) e dispara o evento unificado `contributor_updated`.
  4. A Lista de Cadastros do Sistema (`ContributorsList`) escuta `contributor_updated` para recarregar automaticamente a tabela, e ao editar um contribuinte no Sistema, sincroniza imediatamente o perfil ativo do portal caso pertença à mesma pessoa.

### 8. Padrão Visual Unificado — Seletor de Período e Abas Compactas
- **Comportamento**: Todas as telas que filtram por período devem utilizar o componente compartilhado `PeriodSelector` (`components/reports/PeriodSelector.tsx`) e abas compactas em cápsula segmentada, mantendo altura uniforme (`h-8`), tipografia limpa (`text-xs font-semibold`, sem caixa alta forçada nos rótulos) e alinhamento direto com os filtros de Igreja (`Todas as Igrejas`, ícone `BuildingOfficeIcon`) e Banco (`Todos os Bancos`, ícone `Landmark`).
- **Regra**:
  1. Seletor de Período padrão: cápsula segmentada `[ Mês | Período | Todos ]` (`h-8`, ativo `bg-orange-600 text-white`), seguida de `Mês ▾` + `Ano ▾` no modo `Mês` ou intervalo `Data inicial até Data final` no modo `Período`. Proibido incluir botão extra `Mês Anterior` na barra principal ou variações isoladas por tela.
  2. Abas compactas: agrupamento segmentado único (`p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl border`) com botões `px-3 py-1.5 rounded-lg text-xs font-semibold` (usando `grid-cols-2 sm:inline-flex` no mobile quando houver 4 abas), evitando cards grandes empilhados para seleção de tipo/categoria.
  3. Toda nova tela ou aba revisada que possua seleção de período, abas de categoria/relatório ou filtros de igreja/banco deve adotar exatamente este padrão.

### 9. Padrão Visual Unificado — Botões Discretos de Exportar e Imprimir no Cabeçalho
- **Comportamento**: As ações de Exportar/Baixar e Imprimir devem ficar posicionadas no canto direito do card de cabeçalho inicial da tela, no mesmo formato discreto da aba **Financeiro**, utilizando o componente compartilhado `ExportPrintActions` (`components/reports/ExportPrintActions.tsx`) ou `ReportToolbar` (`components/reports/ReportToolbar.tsx`).
- **Regra**:
  1. Formato padrão: cápsula discreta (`bg-slate-100/80 dark:bg-slate-800/90 rounded-lg p-0.5 border`) com ícone de download (`DocumentArrowDownIcon`, abrindo o menu de formatos CSV, Excel, PDF e OFX quando aplicável) e ícone de impressão (`PrinterIcon`), respeitando automaticamente as permissões `canDownload` e `canPrint` de usuários secundários.
  2. Proibido inserir botões grandes de `Exportar ...` (laranja ou destacados) e `Imprimir` no meio das barras de filtros ou dentro dos cards de tabela quando já existir um card de cabeçalho no topo da tela.
  3. O card de cabeçalho inicial padrão utiliza `px-4 py-2.5 rounded-xl`, caixa de ícone `w-8 h-8` e subtítulo `text-[11px]`, mantendo apenas a ação primária da tela (ex.: `FECHAMENTO`) ao lado do grupo discreto de exportar/imprimir.

### 10. Padrão Visual Unificado — Sub-telas em Modal Suspenso vs. Telas Principais (Sidebar Sempre Visível no Desktop)
- **Comportamento**: As telas principais acessadas pelo menu lateral devem renderizar sempre no layout padrão de página (sem modal suspenso). Os modais suspensos devem ser aplicados **exclusivamente às sub-telas** (ex.: *Plano e Assinatura*, *Cadastro de Conta Bancária*, criação/edição de registros, filtros avançados e visualizações auxiliares), mantendo o menu lateral (`Sidebar`) sempre visível, nítido e livre do backdrop no computador (`md+`).
- **Regra**:
  1. **Telas Principais**: nunca abrem como modal suspenso; utilizam card de cabeçalho inicial compacto (`px-4 py-2.5 rounded-xl`, caixa de ícone `w-8 h-8 rounded-lg bg-orange-50`, título `text-base font-bold`, subtítulo `text-[11px]`), botões primários sólidos `bg-orange-600 hover:bg-orange-700 rounded-lg text-xs font-semibold`, abas compactas segmentadas (ativo `bg-orange-600 text-white`) e tipografia limpa (`font-sans tabular-nums`).
  2. **Sub-telas em Modal Suspenso (em `<ModalsRenderer />`, filho direto de `<main>`)**: utilizar overlay `fixed inset-0 md:absolute md:inset-0 z-[56] flex items-center justify-center pt-16 md:pt-4 pb-3 md:pb-4 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px]`, restringindo backdrop e centralização à área útil à direita da `Sidebar` no desktop.
  3. **Sub-telas em Modal Suspenso (dentro de views em `<AppRouter />`)**: utilizar overlay `fixed inset-0 z-[56] flex items-center justify-center pt-16 md:pt-5 pb-3 md:pb-5 px-2 sm:px-6 bg-slate-900/55 backdrop-blur-[2px]` com card centralizado (`rounded-2xl max-w-3xl max-h-[calc(100dvh-5rem)] md:max-h-[min(88vh,calc(100dvh-3rem))]`), abaixo do `Sidebar` (`z-[80]`). Proibido usar `z-[120]`/`z-[200]` que oculte o menu lateral no desktop ou painéis full-screen `absolute inset-0 bg-white w-full h-full` em sub-telas.
  4. **Disciplina Permanente**: antes de cada novo ajuste visual, consultar todas as regras gravadas (#1 a #11) em `AGENTS.md` e registrar imediatamente qualquer nova convenção definida para aplicação contínua nos ajustes posteriores.

### 11. Padrão Visual Unificado — Barra Contextual de Seleção em Lote no Topo das Tabelas (`BulkActionToolbar`)
- **Comportamento**: Ao selecionar um ou múltiplos registros em tabelas de lançamentos/relatórios (`EditableReportTable` e `ResultsTable`), as ações diretas de 1 clique (`Identificar`, `Confirmar Final`, `Excluir` e `Limpar seleção`) devem aparecer em uma **barra contextual acoplada no topo da tabela** (`sticky top-0 z-30`), com fundo laranja suave (`bg-orange-50/95 dark:bg-orange-950/35 border-b border-orange-200/90`) que contrasta nitidamente com as linhas brancas da tabela, exibindo o contador em badge laranja sólido (`bg-orange-600 text-white`) e a soma acumulada (`tabular-nums`).
- **Regra**:
  1. Proibido usar barra flutuante fixa na parte inferior (`fixed bottom-* z-[85]`) sobre as linhas da tabela — ela se mistura visualmente ao branco das linhas e invade o rodapé de sub-telas/modais abertos (`z-[56]`).
  2. A barra deve permanecer sempre com `z-30` (acima do cabeçalho `thead z-20`, porém estritamente abaixo de todos os modais suspensos `z-[56]` e do menu lateral `z-[80]`), mantendo todas as ações diretas em 1 clique com `title` explicativo e botões brancos com borda sutil para ações secundárias (`Confirmar Final` e `Excluir`) e botão sólido `bg-orange-600` para a ação principal (`Identificar`).

---

# 🧭 PROTOCOLO ORQUESTRADOR DE GOVERNANÇA — ORQ-IG (VERSÃO 2.1)

> **Natureza Real:** `ORQ-IG` e os cinco perfis especializados (`AG-UI`, `AG-FIN`, `AG-BACK`, `AG-OPS`, `AG-QA`) são **contratos comportamentais baseados em regras**, executados pelo **mesmo motor de IA** na mesma sessão. **NÃO** constituem processos autônomos, bloqueio técnico determinístico ou revisão independente isolada. A segurança decorre da adesão disciplinada às regras, de evidências reais executadas e da aprovação humana expressa.

### 1. Hierarquia de Fontes Únicas (Carregamento Sob Demanda)
- **Camada 1 (Sempre carregada):** este `AGENTS.md` (Arquitetura Congelada, Protocolo Cirúrgico, Padrões Blindados `#1`–`#11` e `ORQ-IG`).
- **Camada 2 (Consultar sob demanda via `view_file`):**
  - `PROTECTED_BEHAVIORS.md` — fonte única de `PB-001` a `PB-008` e `CANDIDATO-01` a `CANDIDATO-07`.
  - `.ai/OWNERSHIP.md` — matriz real de propriedade (`E`, `C`, `A`), regras de co-atuação por camada e guarda dos arquivos Categoria 3 (sem utilização confirmada).
  - `.ai/VALIDATION.md` — comandos reais verificados, efeitos colaterais, separação `AUTH-TEST` vs. `AUTH-OPS` e critérios de classificação técnica.
- **Camada 3 (Carregar somente o perfil aplicável à tarefa):**
  - `.ai/profiles/ag-ui.md` — Interface, Padronização Visual (`#1`, `#3`, `#4`, `#8`–`#11`) e Portal UI.
  - `.ai/profiles/ag-fin.md` — Motor Financeiro, Conciliação, Fechamento, Parsers/OCR e Relatórios.
  - `.ai/profiles/ag-back.md` — Backend (`contributors-api/`, `backend/`, `server.js`), `SmartPool`, Auth/JWT/2FA, RBAC, Multi-Tenancy e `types/`.
  - `.ai/profiles/ag-ops.md` — Performance, Memória, Build, Dependências, Higiene, PWA e Backup/Restore.
  - `.ai/profiles/ag-qa.md` — Qualidade, Suítes de Regressão e `PROTECTED_BEHAVIORS.md` *(mesmo motor de IA — nunca apresentar como revisor independente)*.

### 2. Separação Obrigatória de Autorizações (Não Misturar)
- **`AUTH-READ`:** apenas leitura, listagem e busca estática (zero escrita, build, lint ou teste).
- **`AUTH-PLAN`:** apenas diagnóstico, análise e proposta técnica (zero edição ou execução).
- **`AUTH-WRITE`:** edição cirúrgica restrita aos arquivos do escopo aprovado.
- **`AUTH-TEST`:** validação estática, tipos, build e testes autorizados de `.ai/VALIDATION.md` (nunca executar sob `AUTH-READ`/`AUTH-PLAN` e nunca rodar `contributors-api/tests/` em lote cego).
- **`AUTH-OPS`:** autorização separada e explícita para `backup`/`restore`, testes que gravam em `backups/` (subgrupo B4), dependências, `.dockerignore`, `.env.example`, deploy ou remoção de arquivos Categoria 3.

### 3. Níveis de Risco e Roteamento Baseado em Regras
- **`N1` (Somente Leitura / Diagnóstico):** sem alteração de arquivo (`AUTH-READ` / `AUTH-PLAN`).
- **`N2` (Baixo Risco / Isolado):** ajuste visual/CSS ou texto em arquivo `E` ou camada puramente visual de arquivo `C` sem tocar estado, API ou `PB-XXX`.
- **`N3` (Médio/Alto Risco / Regra de Negócio ou PB):** lógica financeira, parsers, rotas CRUD, configs de build/TS, arquivos `A`, ou qualquer arquivo vinculado a `PB-001`–`PB-008` (exige consulta prévia a `PROTECTED_BEHAVIORS.md` e validação específica).
- **`N4` (Crítico / Congelado / Segurança / Operações):** Arquitetura Congelada (`hooks/reconciliation/*`, `contexts/AppContext.tsx`), schema SQL, `SmartPool`, JWT/2FA/RBAC/multi-tenancy, `backup`/`restore`, dependências ou remoção de arquivos Categoria 3 (exige diagnóstico prévio e autorização explícita antes de editar).
- **Regra da Maior Restrição:** em qualquer dúvida de fronteira ou arquivo híbrido (`C`/`A`), prevalece o perfil mais protetor e o maior nível de risco.
- **Ordem Multi-Camada:** quando uma solicitação autorizada exigir mais de uma camada, executar sequencialmente de baixo para cima: `AG-BACK` → `AG-FIN` → `AG-UI` → `AG-OPS` → verificação `AG-QA`.

### 4. Fluxo Operacional Padrão do ORQ-IG
1. Identificar a autorização vigente (`AUTH-READ`, `AUTH-PLAN`, `AUTH-WRITE`, `AUTH-TEST`, `AUTH-OPS`) e o nível de risco (`N1`–`N4`).
2. Consultar `.ai/OWNERSHIP.md` e `PROTECTED_BEHAVIORS.md` para mapear titularidade, categoria (`E`/`C`/`A`), PBs impactadas e arquivos Categoria 3 (proibido editar/remover por engano).
3. Carregar sob demanda apenas o(s) perfil(is) de `.ai/profiles/*.md` aplicável(is) e `.ai/VALIDATION.md` quando houver validação.
4. Executar estritamente dentro da autorização concedida, preservando integralmente todas as regras congeladas e padrões `#1`–`#11`.
5. Entregar o relatório final obrigatório (problema, causa, arquivos alterados, modificações, testes/validações realmente executados, riscos/limitações e classificação objetiva `APROVADO`, `APROVADO COM RESSALVAS` ou `NÃO APROVADO` conforme `.ai/VALIDATION.md`).

