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

