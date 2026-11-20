# MATRIZ OFICIAL DE PROPRIEDADE E RESPONSABILIDADE DE ARQUIVOS — IgGestor

> **Documento de Governança (Camada 2)** — Materializado integralmente a partir da Auditoria Formal de Linha de Base (Etapa 1).  
> **Fonte Única de Regras Universais:** `AGENTS.md` | **Fonte Única de PBs:** `PROTECTED_BEHAVIORS.md`  
> **Regra de Precedência:** Em qualquer conflito ou dúvida de fronteira, aplica-se a **Regra da Maior Restrição** (perfil mais protetor e maior nível de risco).

---

## 1. Legenda de Categorias e Perfis

- **Categorias de Propriedade:**
  - **`E` (Exclusivo):** responsabilidade restrita a um único domínio/perfil.
  - **`C` (Compartilhado por Camada):** arquivo híbrido que mistura 2 ou mais camadas (ex.: JSX + estado + regra financeira + API); a atuação depende da camada efetivamente modificada.
  - **`A` (Alto Impacto / Protegido / Congelado):** arquivo crítico com PBs homologados, Arquitetura Congelada, segurança/RBAC/multi-tenancy, contratos globais ou infraestrutura sensível.
- **Perfis Operacionais Contratuais:**
  - `AG-UI` — Interface, Padronização Visual, Responsividade e Portal UI
  - `AG-FIN` — Motor Financeiro, Conciliação, Fechamento, Parsers/OCR e Relatórios
  - `AG-BACK` — Backend (`contributors-api`/`backend`/`server.js`), `SmartPool`, Autenticação, RBAC e Multi-Tenancy
  - `AG-OPS` — Performance, Memória, Build, Dependências, Higiene de Repositório e Operações
  - `AG-QA` — Qualidade, Suítes de Regressão e Gestão de `PROTECTED_BEHAVIORS.md` *(mesmo motor de IA, não isolado)*

---

## 2. Regras de Co-Atuação em Arquivos Compartilhados (`C`) e Alto Impacto (`A`)

1. **Classificação Bidimensional Obrigatória:** antes de alterar qualquer arquivo `C` ou `A`, o `ORQ-IG` identifica a **camada de mudança** (Visual/CSS, Regra Financeira, Dados/Segurança/RBAC, Performance/Build ou Teste/PB).
2. **Atuação em camada única:** um perfil colaborador (ex.: `AG-UI` ajustando CSS/overlay) só pode atuar isoladamente se não alterar nenhum estado, hook, validação, handler de negócio, contrato de API ou invariante de `PB-XXX` do titular.
3. **Atuação multi-camada:** executar sequencialmente de baixo para cima (`AG-BACK` → `AG-FIN` → `AG-UI` → `AG-OPS` → validação), sem misturar camadas fora do escopo autorizado.
4. **Proibição de refatoração estrutural:** nenhum arquivo híbrido deve ser fragmentado apenas para separar perfis sem autorização explícita N4.

---

## 3. Matriz Completa por Área do Repositório

### 3.1. Views (`views/` — 19 arquivos)

| Caminho Real | Cat. | Titular | Colaboradores | Limites de Atuação | Proteções / Regras | Nível Mín. |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| `views/AppRouter.tsx` | **A** | `AG-OPS` | `AG-UI`, `AG-BACK` | Controla lazy loading, `ModalsRenderer` e rotas por permissão. Proibido `preloadAllViews`. | `AGENTS.md` #2, #10 | **N3** |
| `views/AuthView.tsx` | **C** | `AG-BACK` | `AG-UI` | `AG-UI` só toca apresentação; login/sessão pertence a `AG-BACK`. | `AGENTS.md` #6 | **N2** *(UI)* / **N3** *(auth)* |
| `views/AdminView.tsx` | **C** | `AG-UI` | `AG-BACK` | Container de abas do superadmin; lógica das abas é `AG-BACK`. | `PB-008` *(via aba auditoria)* | **N2** *(UI)* / **N3** *(admin)* |
| `views/DashboardView.tsx` | **C** | `AG-UI` | `AG-FIN` | Apresentação de cards/gráficos; métricas vêm de `useDashboardController`. | `AGENTS.md` #8, #10 | **N2** *(UI)* / **N3** *(métricas)* |
| `views/SavedReportsView.tsx` | **C** | `AG-UI` | `AG-FIN` | Apresentação de planilhas salvas via `useSavedReportsController`. | `AGENTS.md` #8, #10 | **N2** *(UI)* / **N3** *(lógica)* |
| `views/SearchView.tsx` | **C** | `AG-UI` | `AG-FIN` | Interface de busca global via `useSearchController` + checagem de permissões. | `AGENTS.md` #8, #10 | **N2** *(UI)* / **N3** *(busca)* |
| `views/SettingsView.tsx` | **C** | `AG-UI` | `AG-BACK`, `AG-OPS` | Abas de configurações gerais e preferências. | `AGENTS.md` #8, #10 | **N2** *(UI)* / **N3** *(config)* |
| `views/SmartAnalysisView.tsx` | **C** | `AG-FIN` | `AG-UI` | Gerador de planilhas/análise (`ExportService`/`printService`). | `AGENTS.md` #8, #9 | **N2** *(UI)* / **N3** *(cálculo)* |
| `views/LaunchedView.tsx` | **C** | `AG-FIN` | `AG-UI` | Lançamentos efetivados, permissões e exportação. | `AGENTS.md` #8, #9 | **N2** *(UI)* / **N3** *(lógica)* |
| `views/UploadView.tsx` | **A** | `AG-FIN` | `AG-UI`, `AG-QA` | Exibição universal multi-banco sem filtros excludentes de marca. | **`PB-004`** | **N3** |
| `views/RegisterView.tsx` | **C** | `AG-UI` | `AG-BACK` | Abas de cadastro com controle de permissões secundárias. | `AGENTS.md` #7, #8, #10 | **N2** *(UI)* / **N3** *(RBAC)* |
| `views/ReportsView.tsx` | **A** | `AG-FIN` | `AG-UI`, `AG-OPS`, `AG-QA` | Tela principal Financeiro (`overflow-clip` + `BulkActionToolbar`, `SplitTransactionModal`). | **`PB-002`**, `AGENTS.md` #8–#11 | **N2** *(CSS)* / **N3** *(fluxo)* |
| `views/LivroCaixaView.tsx` | **A** | `AG-FIN` | `AG-UI`, `AG-OPS`, `AG-QA` | Híbrido (2.726 l.): paginação, permissões, fechamento (`getAllChurchClosings`) e transporte de saldo. | **`PB-007`**, `AGENTS.md` #3, #8, #9 | **N2** *(CSS)* / **N3** *(lógica)* |
| `views/RelatoriosView.tsx` | **C** | `AG-FIN` | `AG-UI`, `AG-OPS` | Híbrido (2.411 l.): paginação (#3), filtros O(1) (#5), permissões e exportação. | `AGENTS.md` #3, #5, #8, #9 | **N2** *(CSS)* / **N3** *(lógica)* |
| `views/FinancialView.tsx` | **C** | `AG-FIN` | `AG-BACK`, `AG-UI`, `AG-OPS` | Híbrido (2.264 l.): Contas a Pagar/Receber com 7 `fetch` diretos, auth e paginação. | `AGENTS.md` #3, #8, #9 | **N2** *(CSS)* / **N3** *(API/lógica)* |
| `views/PatrimonyView.tsx` | **C** | `AG-UI` | `AG-BACK`, `AG-FIN` | Gestão de patrimônio (1.950 l.) com 2 `fetch` diretos e impressão. | `AGENTS.md` #8, #9, #10 | **N2** *(CSS)* / **N3** *(API/lógica)* |
| `views/PledgesView.tsx` | **C** | `AG-FIN` | `AG-UI`, `AG-BACK` | Gestão de Carnês & Propósitos (1.593 l.). | `AGENTS.md` #8, #10 | **N2** *(CSS)* / **N3** *(lógica)* |
| `views/ConnectorsView.tsx` | **C** | `AG-BACK` | `AG-UI`, `AG-FIN` | Conectores externos (Gmail/automação) com `fetch` e auth. | `AGENTS.md` #10 | **N2** *(CSS)* / **N3** *(integração)* |
| `views/UsersManagementPage.tsx` | **A** | `AG-BACK` | `AG-UI`, `AG-QA` | Gestão de usuários secundários e RBAC (25 pontos auth/perm + 3 `fetch`). | `AGENTS.md` #6 | **N3** / **N4** *(RBAC)* |

---

### 3.2. Components (`components/` — 126 arquivos)

| Caminho Real | Cat. | Titular | Colaboradores | Limites de Atuação | Proteções / Regras | Nível Mín. |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| `components/icons/`, `components/Icons.tsx`, `components/EmptyState.tsx`, `components/SummaryCard.tsx`, `components/dashboard/`, `components/search/`, `components/saved-reports/`, `components/smart-analysis/`, `components/shared/LoadingSpinner.tsx`, `components/shared/Toast.tsx`, `components/shared/GlobalAnnouncementBanner.tsx`, `components/shared/ComparisonSettingsForm.tsx` | **E** | `AG-UI` | `AG-FIN` *(somente cálculos em `smart-analysis/SummationModal.tsx` e `RankingConfigModal.tsx`)* | Componentes de apresentação, gráficos e tabelas auxiliares. | `AGENTS.md` #1, #8–#10 | **N2** |
| `components/BulkActionToolbar.tsx`, `components/reports/PeriodSelector.tsx`, `components/reports/ExportPrintActions.tsx`, `components/reports/ReportToolbar.tsx`, `components/reports/BankChipsList.tsx`, `components/reports/CategoryPills.tsx`, `components/reports/ChurchChipsList.tsx`, `components/reports/ReportSummaryCards.tsx`, `components/reports/StatsStrip.tsx` | **E** | `AG-UI` | `AG-FIN` *(permissões de ação)* | Componentes de padrão visual unificado (`sticky top-0 z-30` na barra de lote; cápsulas de período e exportar/imprimir). | `AGENTS.md` #8, #9, #11 | **N2** |
| `components/layout/Navigation.tsx`, `components/layout/PinchZoomControl.tsx`, `components/shared/SystemVersionMonitor.tsx` | **C** | `AG-UI` | `AG-OPS` | Navegação mobile/desktop, zoom por toque e checagem de versão. | `AGENTS.md` #1 | **N2** *(UI)* / **N3** *(zoom/versão)* |
| `components/layout/Sidebar.tsx` | **A** | `AG-UI` | `AG-FIN`, `AG-QA` | Menu lateral `z-[80]` (Padrão #10) + limpeza defensiva de rascunhos ao trocar de tela (`PB-002`). | **`PB-002`**, `AGENTS.md` #10 | **N3** |
| `components/auth/`, `components/shared/ExpiredBlockOverlay.tsx` | **C** | `AG-BACK` | `AG-UI` | Formulários de login, reset de senha e bloqueio de assinatura. | `AGENTS.md` #6 | **N2** *(CSS)* / **N3** *(auth)* |
| `components/admin/` *(12 arquivos)* | **C** | `AG-BACK` | `AG-UI`, `AG-QA` | Painel superadmin (`AdminAuditTab.tsx` → `PB-008`, `AdminSecurityTab.tsx`, `AdminUsersTab.tsx`, `AdminCommunicationTab.tsx`, `ChurchPortalShareModal.tsx`). | **`PB-008`**, `AGENTS.md` #10 | **N2** *(CSS)* / **N3** *(lógica/audit)* |
| `components/financial/AttachmentPreviewModal.tsx`, `components/financial/ExpenseDocumentUploader.tsx`, `components/scanner/DocumentScannerModal.tsx`, `components/FileUploader.tsx` | **A** | `AG-FIN` | `AG-UI`, `AG-QA` | Preview `z-[9999]`, ação única no chip e rejeição rigorosa de documentos ilegíveis. | **`PB-001`, `PB-003`** | **N3** |
| `components/modals/ManualIdModal.tsx` | **A** | `AG-FIN` | `AG-UI` *(wrapper/CSS)*, `AG-BACK` *(anexos)*, `AG-QA` | Arquivo mais protegido do frontend (2.263 l.). `AG-UI` só toca overlay/header sem alterar `isManualLaunch`, refs, categorias ou anexos. | **`PB-001`, `PB-002`, `PB-003`, `PB-004`, `PB-005`**, `manual_id_church_selection.test.ts` | **N3** |
| `components/modals/QuickAttachModal.tsx`, `components/modals/EditManualTransactionModal.tsx` | **A** | `AG-FIN` | `AG-UI` *(wrapper)*, `AG-BACK`, `AG-QA` | Blindagem `loadedTxIdRef` e persistência real de anexos (anti-wipeout). | **`PB-005`** | **N3** |
| `components/modals/ChurchClosingModal.tsx`, `components/modals/SplitTransactionModal.tsx` | **A** | `AG-FIN` | `AG-UI` *(wrapper #10)*, `AG-BACK` *(ACID/splits)*, `AG-QA` | Fechamento com assinatura digital e transporte bipolar (`PB-007`); desmembramento/rateio (`test_op12`). | **`PB-007`**, `AGENTS.md` #10 | **N3** |
| `components/modals/AutoLaunchModal.tsx`, `components/modals/InitialComparisonModal.tsx`, `components/modals/ManualMatchModal.tsx`, `components/modals/RecompareModal.tsx`, `components/modals/DivergenceConfirmationModal.tsx`, `components/modals/SmartEditModal.tsx`, `components/modals/UpdateReportFilesModal.tsx`, `components/modals/ServiceReceiptModal.tsx`, `components/modals/WhatsAppReceiptModal.tsx`, `components/PastorAutomationTab.tsx`, `components/WhatsAppTemplateConfig.tsx` | **C** | `AG-FIN` | `AG-UI` *(wrapper #10)*, `AG-BACK` *(WhatsApp/automação)* | Fluxos operacionais financeiros, conciliação assistida e recibos. | `AGENTS.md` #10 | **N2** *(wrapper)* / **N3** *(regra)* |
| `components/modals/ConfirmDeleteModal.tsx`, `components/modals/ContractTermsModal.tsx`, `components/modals/DigitalSignatureCollectionSection.tsx`, `components/modals/DigitalSignaturePadModal.tsx`, `components/modals/EditBankModal.tsx`, `components/modals/EditChurchModal.tsx`, `components/modals/GmailSyncModal.tsx`, `components/modals/PaymentModal.tsx`, `components/modals/QuickRegisterModal.tsx`, `components/modals/SaveReportModal.tsx`, `components/modals/SearchFiltersModal.tsx` | **C** | `AG-UI` | `AG-BACK`, `AG-FIN` | Modais auxiliares e de cadastro. Padronização visual segue Padrão #10 (`z-[56]`). | `AGENTS.md` #10 | **N2** *(wrapper)* / **N3** *(lógica)* |
| `components/register/ContributorsList.tsx`, `components/register/PaymentMethodsList.tsx`, `components/register/BanksList.tsx`, `components/register/ChurchesList.tsx`, `components/register/ContributionTypesList.tsx`, `components/register/RegisterModals.tsx`, `components/register/InlineRoleSelector.tsx` | **C** | `AG-BACK` | `AG-UI`, `AG-QA` | `ContributorsList.tsx` (sync bidirecional Portal — Padrão #7); `PaymentMethodsList.tsx` (**`PB-006`**). | `AGENTS.md` #7, **`PB-006`** | **N2** *(CSS)* / **N3** *(CRUD/sync)* |
| `components/register/RegisterListItem.tsx`, `components/register/RegisterTabButton.tsx`, `components/upload/BankManagerMenu.tsx`, `components/upload/SmartBankCard.tsx` | **C** | `AG-UI` | `AG-FIN` (`SmartBankCard.tsx`) | Itens de lista e cartões de bancos na tela de upload. | **`PB-004`** *(indireto)* | **N2** *(UI)* / **N3** *(upload)* |
| `components/reports/EditableReportTable.tsx`, `components/reports/ContributorsReportSection.tsx`, `components/ResultsTable.tsx` | **C** | `AG-UI` | `AG-FIN`, `AG-OPS` | Paginação obrigatória de 50 itens (#3), listeners centralizados (#4), toque (#1) e `BulkActionToolbar` (#11). | `AGENTS.md` #1, #3, #4, #11 | **N2** *(CSS)* / **N3** *(comport.)* |

---

### 3.3. Portal do Contribuinte (`portal/` — 38 arquivos)

| Caminho Real | Cat. | Titular | Colaboradores | Limites de Atuação | Proteções / Regras | Nível Mín. |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| `portal/layout/PortalLayout.tsx`, `portal/components/` *(13 arq.)*, `portal/pages/` *(14 arq. — camada visual)*, `portal/utils/portalFormatters.ts` | **C** | `AG-UI` | `AG-BACK` *(perfil/cadastro/PIX)* | Interface pública responsiva e modais do Portal; não alterar persistência ou cache sem `AG-BACK`. | `AGENTS.md` #1, #7, #8, #10 | **N2** *(UI)* / **N3** *(dados)* |
| `portal/PortalRouter.tsx`, `portal/hooks/` *(6 arq.)*, `portal/types/portal.ts`, `portal/utils/portalProfileCompleteness.ts` | **C** | `AG-BACK` | `AG-UI`, `AG-FIN` *(PIX/contribuições)* | Roteamento público, polling PIX, PWA sync e coerência bidirecional de cadastros (`invalidateContributorsCache`, `contributor_updated`). | `AGENTS.md` #7 | **N3** |

---

### 3.4. Hooks (`hooks/` — 27 arquivos), Contexts (`contexts/` — 9) e Modules (`modules/` — 5)

| Caminho Real | Cat. | Titular | Colaboradores | Limites de Atuação | Proteções / Regras | Nível Mín. |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| `hooks/reconciliation/useCloudSync.ts`, `hooks/reconciliation/useTransactionMatcher.ts`, `hooks/reconciliation/useFileProcessor.ts`, `hooks/useReconciliation.ts`, `contexts/AppContext.tsx` | **A** *(Congelado)* | `AG-FIN` + `AG-BACK` | `AG-QA` *(obrigatório)* | **ARQUITETURA CONGELADA:** proibido refatorar, unificar canais realtime, remover `BLOCK_REGRESSION`/`UPDATE_INSTEAD_REMOVE`/`PostReconstruct` ou unificar `useCloudSync` com `AppContext`. | `AGENTS.md` *(Frozen + #6)*, **`PB-002`, `PB-007`** | **N4** |
| `hooks/useLiveListSync.ts`, `hooks/useReconciliationActions.ts`, `hooks/useReportsController.ts`, `hooks/useAiAutoIdentify.ts`, `hooks/useDataDeletion.ts`, `hooks/useReportManager.ts`, `hooks/useSummaryData.ts`, `hooks/useSmartAnalysisController.ts`, `hooks/useSmartBankCard.ts` | **A** | `AG-FIN` | `AG-BACK`, `AG-QA` | Acoplados diretamente a `batchState`/`lastRealtimeUpdate` de `reconciliation/useCloudSync.ts`; `useLiveListSync.ts` protegido por `PB-004`. | **`PB-004`**, `AGENTS.md` #6 | **N3** |
| `hooks/useReferenceData.ts`, `hooks/useAuthController.ts`, `hooks/useAutomationSync.ts`, `contexts/AuthContext.tsx`, `contexts/auth/` *(4 arq.)*, `modules/user-management/` *(5 arq.)* | **A** | `AG-BACK` | `AG-FIN`, `AG-QA` | Dados de referência em nuvem (`PB-006`), sessão/JWT, limpeza `localStorage`/`IndexedDB` no logout e RBAC secundário. | `AGENTS.md` #6, **`PB-006`** | **N3** / **N4** *(auth/RBAC)* |
| `hooks/useDashboardController.ts`, `hooks/useModalController.ts`, `hooks/useSavedReportsController.ts`, `hooks/useSearchController.ts`, `hooks/useAppController.ts`, `hooks/usePersistentState.ts`, `contexts/AppProviders.tsx`, `contexts/I18nContext.tsx`, `contexts/UIContext.tsx` | **C** | `AG-UI` | `AG-FIN`, `AG-OPS` | Controllers de UI, idioma, estado de modais e provedores React. | `AGENTS.md` #2, #6 | **N2** *(UI)* / **N3** *(estado global)* |
| `hooks/useGlobalDragScroll.ts`, `hooks/usePinchZoom.ts` | **A** | `AG-OPS` | `AG-UI` | **Padrão #1:** `useGlobalDragScroll.ts` nunca pode interceptar `pointerType === 'touch'` ou `'pen'`. | `AGENTS.md` #1 | **N3** |
| `hooks/useCloudSync.ts`, `hooks/useTransactionMatcher.ts`, `hooks/useFileProcessing.ts` | **A** *(Cat. 3)* | `AG-OPS` | `AG-QA` | **Aparentemente sem utilização** (ver Seção 4). Não editar confundindo com `hooks/reconciliation/*`; não remover sem N3/N4. | — | **N3** |

---

### 3.5. Services (`services/` — 34), Core (`core/` — 22), Utils (`utils/` — 13), Constants, Lib e Types

| Caminho Real | Cat. | Titular | Colaboradores | Limites de Atuação | Proteções / Regras | Nível Mín. |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| `core/` *(22 arq.: `adapters/`, `engine/`, `parsers/`, `processors/`, `strategies.ts`, `types/`)*, `utils/expenseDocumentParser.ts`, `utils/imageOcrReader.ts`, `utils/nfeXmlParser.ts`, `utils/bankHelper.ts`, `utils/bankIdentity.ts`, `utils/brazilianDocUtils.ts`, `utils/contributorHelper.ts`, `utils/formatters.ts`, `utils/whatsappReceiptPresets.ts`, `utils/scanner/` *(4 arq.)* | **E** | `AG-FIN` | `AG-QA` | Motor de ingestão/parsers, validação de legibilidade OCR/PDF e utilitários contábeis/fiscais. | **`PB-003`**, `manual_launch_ocr.test.ts`, `pdf_upload_legibility.test.ts`, `test_op14_parsers_robustness.ts` | **N3** |
| `services/ExportService.ts`, `services/LaunchService.ts`, `services/ConsolidationService.ts`, `services/monthClosingService.ts`, `services/expenseAttachmentService.ts`, `services/processingService.ts`, `services/analysisProcessor.ts`, `services/printService.ts`, `services/receiptService.ts`, `services/serviceReceiptService.ts`, `services/rankingService.ts`, `services/modelService.ts`, `services/emailParser.ts`, `services/geminiService.ts`, `services/observationService.ts`, `services/logic/` *(2 arq.)*, `services/utils/parsingUtils.ts` | **E** | `AG-FIN` | `AG-BACK` *(contratos de API)* | Lógica financeira, fechamento, anexos, conciliação e exportação. | **`PB-004`, `PB-005`, `PB-007`**, `test_op17_export_totals_integrity.ts` | **N3** |
| `services/auth/`, `services/authService.ts`, `services/contributorsCache.ts`, `services/profileService.ts`, `services/AdminConfigService.ts`, `services/paymentService.ts`, `services/gmailService.ts`, `services/AutomationMacroService.ts`, `services/CommunicationQueueService.ts`, `services/CommunicationEventService.ts`, `services/monitoringService.ts`, `services/clientDataCache.ts`, `services/serverHelpers.js`, `services/utils/safeFetch.ts` | **C** | `AG-BACK` | `AG-FIN`, `AG-OPS` | Autenticação, cache de contribuintes (Padrão #7), chamadas HTTP seguras e integrações. | `AGENTS.md` #6, #7 | **N3** |
| `constants/bankCatalog.ts`, `lib/translations.ts`, `lib/i18n/pt_biz.ts`, `lib/i18n/pt_ui.ts` | **E** | `AG-UI` | `AG-FIN` | Catálogo de bancos e dicionários de textos PT-BR. | — | **N2** |
| `types.ts`, `types/api.ts`, `types/domain.ts`, `types/supabase.ts`, `types/ui.ts`, `types/supabase/base.ts`, `types/supabase/tables_app.ts`, `types/supabase/tables_core.ts` | **A** | `AG-BACK` | `AG-FIN`, `AG-UI` | Contratos TypeScript globais do sistema. | **`PB-001`, `PB-006`, `PB-007`** | **N3** |
| `types/api-1.ts`, `types/domain-1.ts`, `types/supabase-1.ts`, `types/ui-1.ts`, `types/supabase/base-1.ts`, `types/supabase/tables_app-1.ts`, `types/supabase/tables_core-1.ts` | **A** *(Cat. 3)* | `AG-OPS` | `AG-QA` | **Aparentemente sem utilização** (0 referências; ver Seção 4). Não editar nem remover sem N3/N4. | — | **N3** |

---

### 3.6. Backend (`contributors-api/`, `backend/`, `server.js`), Frontend Shell (`src/`, `public/`), Configs e Testes

| Caminho Real | Cat. | Titular | Colaboradores | Limites de Atuação | Proteções / Regras | Nível Mín. |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| `contributors-api/server.ts` *(13.284 l.)*, `contributors-api/auth/`, `contributors-api/payments/`, `contributors-api/profiles/`, `contributors-api/admin-config/`, `contributors-api/automation-macros/`, `contributors-api/file-models/`, `contributors-api/services/audit.service.ts` | **A** | `AG-BACK` | `AG-FIN`, `AG-QA` | Rotas REST/SSE, `SmartPool` (PG + SQLite), migrations SQL, fechamentos ACID, JWT/2FA, RBAC, IDOR e auditoria. | `AGENTS.md` #6, #7; **`PB-005`, `PB-006`, `PB-007`, `PB-008`** | **N3** *(rota)* / **N4** *(schema/auth/SmartPool)* |
| `contributors-api/services/backup.service.ts`, `contributors-api/services/restore.service.ts`, `contributors-api/services/monitoring.service.ts`, `contributors-api/services/scheduler.service.ts`, `contributors-api/scripts/run-backup.ts`, `contributors-api/scripts/restore-backup.ts` | **A** | `AG-OPS` | `AG-BACK` | Operações de backup, restauração, monitoramento e agendador. | `test_backup_*`, `test_restore_*`, `test_ha_*` | **N4** |
| `backend/middleware/auth.js`, `backend/lib/validateOwnerAccess.js`, `backend/routes/` *(6 arq.)*, `backend/services/ReportService.js`, `server.js` *(463 l.)* | **A** | `AG-BACK` | `AG-OPS` *(startup/static em `server.js`)* | Servidor principal Express, proxy, middleware de auth, rotas auxiliares e `express.static(dist)`. | `AGENTS.md` #6, #7 | **N3** / **N4** *(auth/startup)* |
| `App.tsx`, `src/` *(7 arq.: `index.html`, `index.tsx`, `index.css`, `global.d.ts`, `manifest.json`, `sw.js`, `assets/`)*, `public/` *(7 arq.: `logo.png`, `manifest.json`, `sw.js`, `pwa/`)* | **C** | `AG-OPS` | `AG-UI` | Entrypoint SPA, `#main-scroll-container` (Padrão #1), PWA e assets públicos estáticos. Proibido colocar prints/temporários em `public/`. | `AGENTS.md` #1, #2 | **N2** *(CSS)* / **N3** *(entry/PWA)* |
| `package.json`, `package-lock.json`, `bun.lock`, `contributors-api/package.json`, `contributors-api/package-lock.json`, `contributors-api/tsconfig.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`, `.dockerignore`, `.env.example` | **A** | `AG-OPS` | `AG-BACK` *(deps API)* | Build, compilação, dependências, higiene de Git e contexto Docker. | — | **N3** *(config)* / **N4** *(deps/docker/env)* |
| `sw-1.js`, `contributors-api/package-lock-1.json` | **A** *(Cat. 3)* | `AG-OPS` | `AG-QA` | **Aparentemente sem utilização** (0 referências; ver Seção 4). Não remover sem N3/N4. | — | **N3** |
| `AGENTS.md`, `PROTECTED_BEHAVIORS.md`, `tests/regression/` *(11 arq.)*, `contributors-api/tests/` *(43 arq.)*, `.ai/` | **A** | `AG-QA` | Especialista do domínio | Governança central e suítes de não-regressão. Proibido alterar/afrouxar testes ou PBs sem autorização expressa. | `PROTECTED_BEHAVIORS.md` | **N3** *(testes/PBs)* / **N4** *(regras congeladas)* |

---

## 4. Registro Formal de Arquivos Aparentemente Sem Utilização (Taxonomia 1–4)

Verificados estaticamente na Etapa 1 (imports diretos, aliases `@/`, `import()` dinâmicos, barrels, testes e configurações). **Nenhum arquivo listado abaixo pode ser removido, renomeado ou editado sem autorização expressa N3/N4:**

| Arquivo(s) | Classificação Formal | Motivo / Cuidado |
| :--- | :--- | :--- |
| `hooks/useCloudSync.ts`, `hooks/useTransactionMatcher.ts`, `hooks/useFileProcessing.ts` | **3. Aparentemente sem utilização, com verificação suficiente documentada** | 0 importadores em todo o repo; os hooks ativos vivem em `hooks/reconciliation/{useCloudSync,useTransactionMatcher,useFileProcessor}.ts`. Evitar editar os arquivos da raiz por engano. |
| `types/api-1.ts`, `types/domain-1.ts`, `types/supabase-1.ts`, `types/ui-1.ts`, `types/supabase/base-1.ts`, `types/supabase/tables_app-1.ts`, `types/supabase/tables_core-1.ts` | **3. Aparentemente sem utilização, com verificação suficiente documentada** | 0 referências em todo o repo; cópias sufixadas `-1` paralelas aos contratos ativos em `types/`. |
| `sw-1.js`, `contributors-api/package-lock-1.json` | **3. Aparentemente sem utilização, com verificação suficiente documentada** | 0 referências em todo o repo; artefatos duplicados sufixados `-1`. |

---

## 5. Observação sobre Desalinhamento Documental Registrado (Sem Alteração)

- As Regras Blindadas **#1, #2, #3, #6 e #7** em `AGENTS.md` correspondem funcionalmente aos **`CANDIDATO-03` a `CANDIDATO-07`** em `PROTECTED_BEHAVIORS.md` (que ainda constam como candidatos aguardando homologação formal e sem testes automatizados dedicados). O status atual permanece preservado como está até decisão futura dedicada.
