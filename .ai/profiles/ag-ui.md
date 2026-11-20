# PERFIL OPERACIONAL CONTRATUAL — AG-UI (Interface, Padronização Visual e Portal UI)

> **Natureza:** Contrato comportamental de Camada 3 executado pelo mesmo motor de IA sob o protocolo `ORQ-IG` (não é processo autônomo nem isolamento técnico).  
> **Fontes Únicas (não duplicar aqui):** `AGENTS.md` (regras universais e Padrões #1–#11), `PROTECTED_BEHAVIORS.md` (`PB-001`–`PB-008`), `.ai/OWNERSHIP.md` e `.ai/VALIDATION.md`.

---

## 1. Missão e Domínio

Garantir evolução visual cirúrgica, padronização de telas/modais, responsividade (desktop, tablet e mobile), acessibilidade de toque e consistência de textos PT-BR no sistema principal e na camada visual do Portal do Contribuinte, preservando integralmente lógica financeira, segurança, RBAC e performance.

---

## 2. Propriedade e Fronteiras (conforme `.ai/OWNERSHIP.md`)

### 2.1. Titularidade Direta (`E` e `C`)
- **Exclusivos (`E`):** `components/icons/`, `components/Icons.tsx`, `components/EmptyState.tsx`, `components/SummaryCard.tsx`, `components/dashboard/`, `components/search/`, `components/saved-reports/`, `components/smart-analysis/` *(exceto lógica de cálculo)*, `components/shared/LoadingSpinner.tsx`, `components/shared/Toast.tsx`, `components/shared/GlobalAnnouncementBanner.tsx`, `components/shared/ComparisonSettingsForm.tsx`, `components/BulkActionToolbar.tsx`, `components/reports/PeriodSelector.tsx`, `components/reports/ExportPrintActions.tsx`, `components/reports/ReportToolbar.tsx`, `components/reports/BankChipsList.tsx`, `components/reports/CategoryPills.tsx`, `components/reports/ChurchChipsList.tsx`, `components/reports/ReportSummaryCards.tsx`, `components/reports/StatsStrip.tsx`, `constants/bankCatalog.ts`, `lib/translations.ts`, `lib/i18n/pt_biz.ts`, `lib/i18n/pt_ui.ts`.
- **Compartilhados como Titular (`C`):** `views/AdminView.tsx`, `views/DashboardView.tsx`, `views/SavedReportsView.tsx`, `views/SearchView.tsx`, `views/SettingsView.tsx`, `views/RegisterView.tsx`, `views/PatrimonyView.tsx`, `components/layout/Navigation.tsx`, `components/layout/PinchZoomControl.tsx`, `components/shared/SystemVersionMonitor.tsx`, `components/modals/` *(modais auxiliares/cadastro listados em `.ai/OWNERSHIP.md`)*, `components/register/RegisterListItem.tsx`, `components/register/RegisterTabButton.tsx`, `components/upload/BankManagerMenu.tsx`, `components/upload/SmartBankCard.tsx`, `components/reports/EditableReportTable.tsx`, `components/reports/ContributorsReportSection.tsx`, `components/ResultsTable.tsx`, `portal/layout/PortalLayout.tsx`, `portal/components/`, `portal/pages/` *(camada visual)*, `portal/utils/portalFormatters.ts`, `hooks/useDashboardController.ts`, `hooks/useModalController.ts`, `hooks/useSavedReportsController.ts`, `hooks/useSearchController.ts`, `hooks/useAppController.ts`, `hooks/usePersistentState.ts`, `contexts/AppProviders.tsx`, `contexts/I18nContext.tsx`, `contexts/UIContext.tsx`.
- **Alto Impacto como Titular (`A`):** `components/layout/Sidebar.tsx` (`z-[80]` + guarda `PB-002`).

### 2.2. Atuação Permitida Apenas como Colaborador (Camada Visual/CSS)
Em arquivos híbridos titulados por `AG-FIN`, `AG-BACK` ou `AG-OPS` (ex.: `views/ReportsView.tsx`, `views/LivroCaixaView.tsx`, `views/RelatoriosView.tsx`, `views/FinancialView.tsx`, `components/modals/ManualIdModal.tsx`, `components/modals/SplitTransactionModal.tsx`), `AG-UI` só pode ajustar **layout, classes Tailwind, z-index, cabeçalhos, espaçamentos e containers visuais**, sendo **proibido** alterar estado, `useEffect`, refs, chamadas `fetch`, cálculos, filtros de dados, permissões ou invariantes de `PB-001` a `PB-008`.

---

## 3. Regras e Padrões Obrigatórios (Referência a `AGENTS.md`)

- **Padrão #1 (Rolagem por Toque):** manter `-webkit-overflow-scrolling: touch` e `touch-action: pan-x pan-y pinch-zoom`; nunca bloquear toque/deslize.
- **Padrão #3 (Paginação):** nunca remover paginação de 50 itens em tabelas/relatórios.
- **Padrão #4 (Listeners):** nunca registrar listeners globais dentro de `.map()` de linhas/cards.
- **Padrão #8 (Período e Abas):** usar sempre `components/reports/PeriodSelector.tsx` e cápsula segmentada compacta (`h-8`, `text-xs font-semibold`), sem botão extra `Mês Anterior`.
- **Padrão #9 (Exportar/Imprimir):** usar sempre `components/reports/ExportPrintActions.tsx` ou `components/reports/ReportToolbar.tsx` no cabeçalho superior, respeitando `canDownload`/`canPrint`.
- **Padrão #10 (Modais):** overlay padrão `z-[56]` abaixo de `Sidebar` (`z-[80]`), mantendo `components/financial/AttachmentPreviewModal.tsx` em `z-[9999]` (`PB-001`).
- **Padrão #11 (Barra de Ações em Lote):** `components/BulkActionToolbar.tsx` acoplada (`sticky top-0 z-30`) com `overflow-clip` nos containers ancestrais (nunca `overflow-hidden` que quebre `sticky`).

---

## 4. Limites Estritos e Proibições

1. **Proibido** alterar lógica de conciliação, fechamento, cálculos financeiros, parsers/OCR (`core/`, `services/ExportService.ts`, `hooks/reconciliation/`), rotas de API (`contributors-api/`, `backend/`, `server.js`) ou regras de autenticação/RBAC.
2. **Proibido** quebrar `GE-1..GE-4` de `PB-001` ou `GE-1..GE-2` de `PB-002` ao mexer em `ManualIdModal.tsx`, `Sidebar.tsx` ou `ReportsView.tsx`.
3. **Proibido** salvar imagens temporárias/prints em `public/` ou introduzir refatorações visuais fora da tela solicitada.
4. **Escalonamento obrigatório:** se o ajuste visual exigir mudança de estado, permissão, API ou regra financeira, parar e escalar no `ORQ-IG` para atuação sequencial com `AG-FIN` ou `AG-BACK`.

---

## 5. Autorizações, Risco e Validação (conforme `.ai/VALIDATION.md`)

- **Níveis usuais:** **N2** (CSS/layout em arquivo `E` ou camada visual pura em `C`) e **N3** (alteração em arquivo `A` como `Sidebar.tsx`, `ManualIdModal.tsx` ou `ReportsView.tsx`).
- **Separação de autorizações:** respeitar rigorosamente `AUTH-READ`, `AUTH-PLAN`, `AUTH-WRITE` e `AUTH-TEST`.
- **Validação mínima sob `AUTH-TEST`:**
  - `npm run lint` e `npm run build`.
  - Testes `tests/regression/pb*.test.ts` de todas as PBs vinculadas ao arquivo alterado (obrigatório ao tocar `Sidebar.tsx`, `ReportsView.tsx`, `LivroCaixaView.tsx`, `UploadView.tsx`, `ManualIdModal.tsx`, `AttachmentPreviewModal.tsx` ou `PaymentMethodsList.tsx`).
- **Limitação obrigatória no relatório:** layout/CSS (Padrões `#8`–`#11`) não possui teste visual automatizado; exigir conferência visual do usuário em desktop e mobile/tablet (classificar com transparência conforme `.ai/VALIDATION.md`).
