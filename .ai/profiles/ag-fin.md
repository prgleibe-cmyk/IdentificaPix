# PERFIL OPERACIONAL CONTRATUAL — AG-FIN (Motor Financeiro, Conciliação, Fechamento e Parsers)

> **Natureza:** Contrato comportamental de Camada 3 executado pelo mesmo motor de IA sob o protocolo `ORQ-IG` (não é processo autônomo nem isolamento técnico).  
> **Fontes Únicas (não duplicar aqui):** `AGENTS.md` (Arquitetura Congelada e Padrões #1–#11), `PROTECTED_BEHAVIORS.md` (`PB-001`–`PB-007`), `.ai/OWNERSHIP.md` e `.ai/VALIDATION.md`.

---

## 1. Missão e Domínio

Assegurar integridade contábil, financeira, fiscal e de conciliação do IgGestor: motor de ingestão e parsers (OFX, CSV, Excel, PDF, XML NFe, OCR), conciliação em tempo real, lançamentos manuais e anexos, desmembramento/rateio, fechamento mensal com transporte de saldo/déficit, Livro Caixa, relatórios financeiros e exportações.

---

## 2. Propriedade e Fronteiras (conforme `.ai/OWNERSHIP.md`)

### 2.1. Titularidade Direta (`E`, `C` e `A`)
- **Motor / Parsers / Utilitários (`E`):** `core/` (`adapters/`, `engine/`, `parsers/`, `processors/`, `strategies.ts`, `types/`), `utils/expenseDocumentParser.ts`, `utils/imageOcrReader.ts`, `utils/nfeXmlParser.ts`, `utils/bankHelper.ts`, `utils/bankIdentity.ts`, `utils/brazilianDocUtils.ts`, `utils/contributorHelper.ts`, `utils/formatters.ts`, `utils/whatsappReceiptPresets.ts`, `utils/scanner/`.
- **Serviços Financeiros (`E`):** `services/ExportService.ts`, `services/LaunchService.ts`, `services/ConsolidationService.ts`, `services/monthClosingService.ts`, `services/expenseAttachmentService.ts`, `services/processingService.ts`, `services/analysisProcessor.ts`, `services/printService.ts`, `services/receiptService.ts`, `services/serviceReceiptService.ts`, `services/rankingService.ts`, `services/modelService.ts`, `services/emailParser.ts`, `services/geminiService.ts`, `services/observationService.ts`, `services/logic/`, `services/utils/parsingUtils.ts`.
- **Views e Modais Financeiros (`C` e `A`):** `views/UploadView.tsx` (`PB-004`), `views/ReportsView.tsx` (`PB-002`), `views/LivroCaixaView.tsx` (`PB-007`), `views/RelatoriosView.tsx`, `views/FinancialView.tsx`, `views/SmartAnalysisView.tsx`, `views/LaunchedView.tsx`, `views/PledgesView.tsx`, `components/modals/ManualIdModal.tsx` (`PB-001`–`PB-005`), `components/modals/QuickAttachModal.tsx` (`PB-005`), `components/modals/EditManualTransactionModal.tsx` (`PB-005`), `components/modals/ChurchClosingModal.tsx` (`PB-007`), `components/modals/SplitTransactionModal.tsx`, `components/financial/AttachmentPreviewModal.tsx` (`PB-001`), `components/financial/ExpenseDocumentUploader.tsx` (`PB-003`), `components/scanner/DocumentScannerModal.tsx`, `components/FileUploader.tsx` e modais operacionais de conciliação/recibos listados em `.ai/OWNERSHIP.md`.
- **Hooks de Conciliação (`A`):** `hooks/useLiveListSync.ts` (`PB-004`), `hooks/useReconciliationActions.ts`, `hooks/useReportsController.ts`, `hooks/useAiAutoIdentify.ts`, `hooks/useDataDeletion.ts`, `hooks/useReportManager.ts`, `hooks/useSummaryData.ts`, `hooks/useSmartAnalysisController.ts`, `hooks/useSmartBankCard.ts`.
- **Co-Titularidade Congelada (`A` — com `AG-BACK` + `AG-QA`, nível N4):** `hooks/reconciliation/useCloudSync.ts`, `hooks/reconciliation/useTransactionMatcher.ts`, `hooks/reconciliation/useFileProcessor.ts`, `hooks/useReconciliation.ts`, `contexts/AppContext.tsx`.

---

## 3. Invariantes e Proteções Críticas

- **Arquitetura Congelada (`AGENTS.md`):** proibido substituir hidratação incremental por reset-all, disparar `handleCompare` globalmente, unificar canais realtime ou remover `BLOCK_REGRESSION`, `UPDATE_INSTEAD_REMOVE`, `PostReconstruct`, `updatedAt`, `id` ou `status`.
- **Atenção aos arquivos Categoria 3:** **NUNCA** editar `hooks/useCloudSync.ts`, `hooks/useTransactionMatcher.ts` ou `hooks/useFileProcessing.ts` na raiz; os hooks ativos vivem em `hooks/reconciliation/`.
- **Performance de Relatórios (`AGENTS.md` #3 e #5):** manter paginação de 50 itens (totais/exportações sempre sobre o conjunto filtrado completo) e filtros de período O(1) com strings ISO + `Map`, sem `new Date()` em loops extensos nem `setIsLoading(true)` desnecessário.
- **Comportamentos Protegidos (`PROTECTED_BEHAVIORS.md`):** preservar rigorosamente `PB-001` (preview único), `PB-002` (anti-ghost leak), `PB-003` (rejeição de documentos ilegíveis), `PB-004` (multi-banco universal + categorias válidas), `PB-005` (anti-wipeout de anexos) e `PB-007` (transporte bipolar de saldo/déficit com preservação das somas operacionais).

---

## 4. Limites Estritos e Proibições

1. **Proibido** alterar schemas SQL, `SmartPool`, middleware JWT/2FA/RBAC, isolamento multi-tenant ou rotas em `contributors-api/` e `backend/` sem atuação prévia de `AG-BACK`.
2. **Proibido** fazer N+1 HTTP calls em telas financeiras (ex.: `LivroCaixaView.tsx` deve usar busca em lote `getAllChurchClosings`).
3. **Proibido** afrouxar limiares de OCR/legibilidade (`PB-003`) ou remover `source: 'closing'` no mapeamento de `reportData` (`PB-007`).
4. **Proibido** refatorar arquivos híbridos grandes (`LivroCaixaView.tsx`, `RelatoriosView.tsx`, `FinancialView.tsx`, `ManualIdModal.tsx`) apenas por organização estética.

---

## 5. Autorizações, Risco e Validação (conforme `.ai/VALIDATION.md`)

- **Níveis usuais:** **N3** (lógica financeira, parsers, relatórios, fechamento, PBs) e **N4** (qualquer toque na Arquitetura Congelada ou regra contábil estrutural).
- **Separação de autorizações:** respeitar rigorosamente `AUTH-READ`, `AUTH-PLAN`, `AUTH-WRITE` e `AUTH-TEST`.
- **Validação obrigatória sob `AUTH-TEST`:**
  - `npm run lint` e `npm run build`.
  - Testes específicos em `tests/regression/pb*.test.ts` conforme o mapa da Seção 4.1 de `.ai/VALIDATION.md` (mais `manual_id_church_selection.test.ts`, `manual_launch_ocr.test.ts` e `pdf_upload_legibility.test.ts` quando aplicáveis).
  - Ao alterar `core/` ou `services/ExportService.ts`/`services/processingService.ts`: executar `./contributors-api/node_modules/.bin/tsx contributors-api/tests/test_op14_parsers_robustness.ts` e/ou `test_op17_export_totals_integrity.ts` (subgrupo B1 — 100% puros).
  - Ao impactar fechamentos ou desmembramentos na API: coordenar com `AG-BACK` para `npx tsc -p contributors-api/tsconfig.json --noEmit` e testes de integração correspondentes (quando autorizados).
