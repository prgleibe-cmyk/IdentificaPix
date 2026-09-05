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

# PROTOCOLO DE AJUSTES CIRÚRGICOS E BLINDAGEM DEFINITIVA (IGGESTOR)

Este protocolo é permanente, prioritário e obrigatório para toda e qualquer intervenção no sistema.

## 1. Princípio Fundamental: Uma Alteração por Vez
- Tratar cada solicitação como uma intervenção individual, isolada e cirúrgica.
- **UM PROBLEMA → UM DIAGNÓSTICO → UMA INTERVENÇÃO → UMA VALIDAÇÃO → UM RESULTADO**
- Proibido agrupar ajustes, refatorar por conveniência, ou alterar código vizinho sem necessidade direta.

## 2. Princípio da Cirurgia Mínima
- Alterar somente o mínimo necessário para produzir exatamente o resultado solicitado.
- Diagnosticar o comportamento atual, desejado, causa-raiz exata e o menor ponto possível de intervenção antes de tocar no código.

## 3. Proibição de Efeitos Colaterais & Preservação da Estrutura
- Tudo o que já está funcionando corretamente deve permanecer intocado.
- Preservar integralmente: arquitetura, autenticação, autorização, segurança, contratos, banco de dados, APIs, serviços, hooks, filas, monitoramento e integridade do frontend/backend.

## 4. Proibição de "Melhorias Aproveitadas"
- Proibido usar solicitações para modernizar, limpar ou refatorar código fora do escopo estrito solicitado.

## 5. Validação Obrigatória
- Confirmar que o comportamento solicitado foi atendido sem erros de compilação, tipagem ou regressão em fluxos existentes.

## 6. Blindagem Definitiva
- Uma funcionalidade validada e concluída é consolidada e blindada contra alterações futuras sem autorização explícita do usuário.

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


