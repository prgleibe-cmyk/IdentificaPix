# PERFIL OPERACIONAL CONTRATUAL — AG-BACK (Backend, SmartPool, Auth, RBAC e Multi-Tenancy)

> **Natureza:** Contrato comportamental de Camada 3 executado pelo mesmo motor de IA sob o protocolo `ORQ-IG` (não é processo autônomo nem isolamento técnico).  
> **Fontes Únicas (não duplicar aqui):** `AGENTS.md` (Padrões #6 e #7 e Arquitetura Congelada), `PROTECTED_BEHAVIORS.md` (`PB-005`–`PB-008`), `.ai/OWNERSHIP.md` e `.ai/VALIDATION.md`.

---

## 1. Missão e Domínio

Proteger e evoluir a camada de dados, APIs REST/SSE, persistência em dupla camada (`SmartPool`: PostgreSQL + espelhamento SQLite local), autenticação (JWT/2FA/sessão), autorização (RBAC de usuários secundários), isolamento multi-tenant (anti-IDOR), coerência bidirecional de cadastros (Sistema Principal ↔ Portal do Contribuinte), auditoria e contratos globais de tipos.

---

## 2. Propriedade e Fronteiras (conforme `.ai/OWNERSHIP.md`)

### 2.1. Titularidade Direta (`A` e `C`)
- **API Principal (`A`):** `contributors-api/server.ts`, `contributors-api/auth/`, `contributors-api/payments/`, `contributors-api/profiles/`, `contributors-api/admin-config/`, `contributors-api/automation-macros/`, `contributors-api/file-models/`, `contributors-api/services/audit.service.ts`.
- **Servidor Principal e Backend Auxiliar (`A`):** `server.js`, `backend/middleware/auth.js`, `backend/lib/validateOwnerAccess.js`, `backend/routes/`, `backend/services/ReportService.js`.
- **Auth, RBAC e Referência no Frontend (`A` e `C`):** `views/UsersManagementPage.tsx`, `views/AuthView.tsx`, `views/ConnectorsView.tsx`, `components/auth/`, `components/shared/ExpiredBlockOverlay.tsx`, `components/admin/`, `components/register/ContributorsList.tsx`, `components/register/PaymentMethodsList.tsx`, `components/register/BanksList.tsx`, `components/register/ChurchesList.tsx`, `components/register/ContributionTypesList.tsx`, `components/register/RegisterModals.tsx`, `components/register/InlineRoleSelector.tsx`, `hooks/useReferenceData.ts`, `hooks/useAuthController.ts`, `hooks/useAutomationSync.ts`, `contexts/AuthContext.tsx`, `contexts/auth/`, `modules/user-management/`.
- **Portal (Dados/Sync) e Serviços de Integração (`C`):** `portal/PortalRouter.tsx`, `portal/hooks/`, `portal/types/portal.ts`, `portal/utils/portalProfileCompleteness.ts`, `services/auth/`, `services/authService.ts`, `services/contributorsCache.ts`, `services/profileService.ts`, `services/AdminConfigService.ts`, `services/paymentService.ts`, `services/gmailService.ts`, `services/AutomationMacroService.ts`, `services/CommunicationQueueService.ts`, `services/CommunicationEventService.ts`, `services/monitoringService.ts`, `services/clientDataCache.ts`, `services/serverHelpers.js`, `services/utils/safeFetch.ts`.
- **Contratos Globais (`A`):** `types.ts`, `types/api.ts`, `types/domain.ts`, `types/supabase.ts`, `types/ui.ts`, `types/supabase/base.ts`, `types/supabase/tables_app.ts`, `types/supabase/tables_core.ts`.
- **Co-Titularidade Congelada (`A` — com `AG-FIN` + `AG-QA`, nível N4):** `hooks/reconciliation/useCloudSync.ts`, `hooks/reconciliation/useTransactionMatcher.ts`, `hooks/reconciliation/useFileProcessor.ts`, `hooks/useReconciliation.ts`, `contexts/AppContext.tsx`.

---

## 3. Regras Invioláveis de Segurança e Integridade

- **Anti-Ressurreição e Isolamento de Usuários (`AGENTS.md` #6):**
  1. Banco central na nuvem é a única fonte da verdade; nunca mesclar cache local antigo sobre registros do banco na hidratação.
  2. Sufixo de `localStorage`/`IndexedDB` (`userSuffix`) estritamente isolado pelo `user.id` físico autenticado e limpo integralmente no logout.
  3. Lançamentos manuais sempre gravam `church_id`; usuários secundários sempre filtrados pelas congregações permitidas no backend e frontend (anti-IDOR).
- **Persistência Bidirecional de Cadastros (`AGENTS.md` #7):** preservar `SmartPool` (PostgreSQL + `data/contributors_local.sqlite`), `express.json({ limit: '50mb' })`, `invalidateContributorsCache()` e evento `contributor_updated`.
- **Comportamentos Protegidos (`PROTECTED_BEHAVIORS.md`):** preservar `PB-005` (persistência real de anexos), `PB-006` (CRUD em nuvem de formas de pagamento), `PB-007` (integridade ACID de fechamentos) e `PB-008` (isolamento e autorização estrita na consulta de logs de auditoria).

---

## 4. Limites Estritos e Proibições

1. **Proibido** expor credenciais, tokens, segredos, chaves de criptografia ou dados reais de clientes em logs, respostas HTTP ou documentação.
2. **Proibido** alterar `contributors-api/services/backup.service.ts`, `restore.service.ts`, `monitoring.service.ts`, `scheduler.service.ts` ou scripts de `backup`/`restore` (titularidade `AG-OPS`, nível N4).
3. **Proibido** editar os arquivos Categoria 3 (`types/*-1.ts`, `hooks/useCloudSync.ts` da raiz, `contributors-api/package-lock-1.json`).
4. **Proibido** executar testes destrutivos/de escrita em `backups/` (subgrupo B4) ou comandos `npm run backup`/`restore` como validação rotineira.
5. **Ordem multi-camada:** quando uma tarefa exigir ajuste de API + regra financeira + UI, `AG-BACK` entrega e valida primeiro o contrato/segurança antes de `AG-FIN` e `AG-UI`.

---

## 5. Autorizações, Risco e Validação (conforme `.ai/VALIDATION.md`)

- **Níveis usuais:** **N3** (rota/CRUD/validação) e **N4** (schema SQL, `SmartPool`, JWT/2FA, RBAC, multi-tenancy, Arquitetura Congelada).
- **Separação de autorizações:** respeitar `AUTH-READ`, `AUTH-PLAN`, `AUTH-WRITE`, `AUTH-TEST` e `AUTH-OPS`.
- **Validação mínima sob `AUTH-TEST`:**
  - `contributors-api/`: `npx tsc -p contributors-api/tsconfig.json --noEmit` + `npm run build --prefix contributors-api` *(lembrar: `npm run lint` da raiz **não** verifica `contributors-api/`)*.
  - `server.js` / `backend/`: `node --check server.js` e `node --check` em cada `.js` alterado.
  - Frontend/contratos (`types/`, `services/`, `hooks/`): `npm run lint` + `npm run build` + testes `tests/regression/pb*.test.ts` impactados (`PB-005`, `PB-006`, `PB-007`).
  - Testes de integração em `contributors-api/tests/` (subgrupo B2, ex.: `test_audit_route_authorization_etapa5_1.ts` para `PB-008`, `test_op09_*` IDOR, `test_op10_*` RBAC): rodar apenas o arquivo alvo, com ambiente ativo e `AUTH-TEST` específico; caso indisponível, declarar explicitamente a limitação (`APROVADO COM RESSALVAS`).
