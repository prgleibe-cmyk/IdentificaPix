# MANUAL DE VALIDAÇÃO REAL — IgGestor

> **Documento de Governança (Camada 2)** — Baseado exclusivamente em comandos, scripts e suítes verificados estaticamente no repositório (Etapa 1 / Etapa 3).  
> **Fonte Única de Regras Universais:** `AGENTS.md` | **Fonte Única de PBs:** `PROTECTED_BEHAVIORS.md` | **Propriedade:** `.ai/OWNERSHIP.md`

---

## 1. Separação Obrigatória de Autorizações

Nenhum comando listado neste manual pode ser executado fora da autorização correspondente:

| Autorização | O que permite | O que PROÍBE |
| :--- | :--- | :--- |
| **`AUTH-READ`** | Leitura de arquivos, listagem de diretórios e buscas estáticas (`view_file`, `list_dir`, `grep` somente leitura). | Qualquer escrita de arquivo, build, lint, type-check, teste ou comando operacional. |
| **`AUTH-PLAN`** | Diagnóstico, proposta técnica e planejamento sem efeitos colaterais. | Qualquer edição, build, lint, teste ou comando operacional. |
| **`AUTH-WRITE`** | Edição cirúrgica restrita aos arquivos aprovados no escopo. | Executar testes/builds/lints não autorizados ou operações de infraestrutura. |
| **`AUTH-TEST`** | Validação estática, checagem de tipos, compilação e execução de testes autorizados no escopo (sempre declarando efeitos colaterais de cache/artefatos). | Comandos operacionais de backup/restore, deploy, alterações de banco de produção ou instalação de dependências. |
| **`AUTH-OPS`** | Operações sensíveis: `backup`, `restore`, deploy, alteração de `.dockerignore`, dependências, variáveis de ambiente ou testes que gravam em `backups/` / alteram estado persistente. | Execução rotineira sem autorização explícita por etapa. |

> **Regra de Transparência:** se uma validação não foi executada por ausência de `AUTH-TEST` ou de serviço/banco ativo, isso deve ser declarado explicitamente no relatório final — **nunca** classificar como validado o que não foi executado.

---

## 2. Fatos Verificados de Ambiente e Ferramentas (Evitar Comandos Inexistentes)

- **Não existe ESLint no repositório:** `npm run lint` executa `tsc --noEmit` (TypeScript), **não** ESLint.
- **Não existe `npm run test:regression` em `package.json`:** embora citado historicamente no fluxograma de `PROTECTED_BEHAVIORS.md`, esse script não está definido em `package.json`. Os testes de `tests/regression/` são executados diretamente via `tsx --test` (ver Seção 3).
- **Localização do binário `tsx`:** `tsx` está instalado em `contributors-api/node_modules/.bin/tsx` (não existe em `node_modules/.bin/tsx` na raiz).
- **Escopo real do `tsconfig.json` da raiz:** exclui `["node_modules", "dist", "contributors-api"]`. Portanto, `npm run lint` / `lint_applet` **NÃO verifica** arquivos dentro de `contributors-api/`.
- **Escopo real do `contributors-api/tsconfig.json`:** exclui `["node_modules", "dist", "tests", "scripts"]`. Portanto, `npx tsc -p contributors-api/tsconfig.json --noEmit` verifica o servidor/módulos da API, mas **NÃO verifica** `contributors-api/tests/` nem `contributors-api/scripts/`.

---

## 3. Inventário Real de Comandos e Efeitos Colaterais

### 3.1. Validação Estática, Tipos e Compilação (`AUTH-TEST`)

| Comando / Ferramenta | Escopo Real Verificado | Efeitos Colaterais em Disco / Estado | Autorização |
| :--- | :--- | :--- | :---: |
| `npm run lint` *(equiv. `tsc --noEmit` / `lint_applet`)* | Frontend e arquivos TS/TSX da raiz (exclui `contributors-api/`, `dist/`, `node_modules/`). | Grava/atualiza cache incremental em `node_modules/.cache/tsconfig.tsbuildinfo`. Não gera `dist/`. | **`AUTH-TEST`** |
| `npm run type-check` *(equiv. `tsc` com `noEmit: true`)* | Mesmo escopo de `npm run lint`. | Grava/atualiza `node_modules/.cache/tsconfig.tsbuildinfo`. | **`AUTH-TEST`** |
| `npx tsc -p contributors-api/tsconfig.json --noEmit` | Tipagem estrita de `contributors-api/` (exclui `tests/` e `scripts/`). | **Zero escrita em disco** (`--noEmit`, sem `incremental`). | **`AUTH-TEST`** |
| `node --check server.js` | Verificação sintática do servidor principal `server.js`. | **Zero escrita em disco.** | **`AUTH-TEST`** |
| `node --check backend/middleware/auth.js` *(ou qualquer `.js` em `backend/` / `services/serverHelpers.js`)* | Verificação sintática de módulos JS do backend. | **Zero escrita em disco.** | **`AUTH-TEST`** |
| `npm run build` *(equiv. `vite build && npx tsc -p contributors-api/tsconfig.json` / `compile_applet`)* | Build de produção do frontend + compilação TS de `contributors-api/`. | **Sobrescreve** `dist/` e `contributors-api/dist/`. | **`AUTH-TEST`** |
| `npm run build --prefix contributors-api` | Compilação TS isolada de `contributors-api/`. | **Sobrescreve** `contributors-api/dist/`. | **`AUTH-TEST`** |

### 3.2. Suítes de Testes Automatizados

#### A) Regressão Estrutural e Comportamental (`tests/regression/` — 11 arquivos)
Verificados estaticamente como **100% puros** (`write=0`, `net=0`, `db=0`), usando `node:test` + leitura estática/memória:

- **Comando unitário (arquivo específico):**
  `./contributors-api/node_modules/.bin/tsx --test tests/regression/<arquivo>.test.ts`
- **Comando completo da suíte (11 arquivos):**
  `./contributors-api/node_modules/.bin/tsx --test tests/regression/*.test.ts`
- **Efeitos colaterais:** **Zero escrita em disco, zero rede, zero banco.**
- **Autorização:** **`AUTH-TEST`**.

Arquivos existentes em `tests/regression/`:
1. `tests/regression/harness.test.ts` *(infraestrutura/protocolo — **NÃO comprova PB isoladamente**)*
2. `tests/regression/pb001_manual_launch_preview.test.ts`
3. `tests/regression/pb002_manual_launch_cancellation.test.ts`
4. `tests/regression/pb003_document_legibility_rejection.test.ts`
5. `tests/regression/pb004_multibank_and_category_validation.test.ts`
6. `tests/regression/pb005_attachment_persistence_and_anti_wipeout.test.ts`
7. `tests/regression/pb006_payment_methods_cloud_persistence.test.ts`
8. `tests/regression/pb007_church_closing_balance_transport.test.ts`
9. `tests/regression/manual_id_church_selection.test.ts`
10. `tests/regression/manual_launch_ocr.test.ts`
11. `tests/regression/pdf_upload_legibility.test.ts`

#### B) Testes da API (`contributors-api/tests/` — 43 arquivos)
Classificados estaticamente em **4 subgrupos de risco** — **NUNCA executar em lote cego**:

| Subgrupo | Qtd. | Arquivos | Comportamento / Efeito Colateral | Autorização |
| :--- | :---: | :--- | :--- | :---: |
| **B1. Puros (import direto em memória)** | 2 | `contributors-api/tests/test_op14_parsers_robustness.ts`, `contributors-api/tests/test_op17_export_totals_integrity.ts` | Sem HTTP, sem SQL, sem escrita em disco. Comando: `./contributors-api/node_modules/.bin/tsx contributors-api/tests/<arquivo>.ts`. | **`AUTH-TEST`** |
| **B2. Integração (HTTP / SQL / spawn)** | 37 | `test_audit_route_authorization_etapa5_1.ts` (`PB-008`), `test_2fa_etapa8.ts`, `test_audit_etapa5.ts`, `test_ha_audit_etapa11.ts`, `test_ha_backup_list.ts`, `test_ha_backup_lock.ts`, `test_ha_monitoring_lock.ts`, `test_ha_queue_recovery.ts`, `test_ha_ratelimit_postgres.ts`, `test_monitoring_etapa9.ts`, `test_op08_1_church_closings_delete_auth.ts`, `test_op08_2_etapa1_transfers_identity.ts`, `test_op08_2_subetapa2_2_reopen_atomic.ts`, `test_op08_2_subetapa2_3_closing_atomic.ts`, `test_op08_2_subetapa2_4_concurrency_locks.ts`, `test_op09_subetapa2_transactions_idor.ts`, `test_op09_subetapa3_financial_records_idor.ts`, `test_op09_subetapa4_creation_tenant_check.ts`, `test_op10_subetapa3_3_structural_permissions.ts`, `test_op10_subetapa3_4_operational_permissions.ts`, `test_op10_subetapa3_5_user_management_permissions.ts`, `test_op11_smartpool_integrity_concurrency.ts`, `test_op12_splits_integrity.ts`, `test_op13_closed_periods_and_closing_legs.ts`, `test_op15_bulk_idempotency_bank_isolation.ts`, `test_op16_saved_reports_security.ts`, `test_op18_audit_trail_hardening.ts`, `test_op19_profile_audit_tracking.ts`, `test_op20_failover_and_recovery.ts`, `test_pillar5_consolidation.ts`, `test_pillar6_consolidation.ts`, `test_pillar7_consolidation.ts`, `test_pillar8_consolidation.ts`, `test_pillar9_consolidation.ts`, `test_rate_limit_etapa6.ts`, `test_restore_etapa4.ts`, `test_security_dashboard_etapa10.ts` | Exigem API/banco ativos ou `spawn` e criam/alteram registros de teste no banco ou estado da API. Executar apenas o arquivo alvo, com ambiente controlado confirmado. | **`AUTH-TEST`** *(específico + ambiente isolado/confirmado)* |
| **B3. Import direto de `../server.js`** | 1 | `contributors-api/tests/test_op10_subetapa3_2_permissions_context.ts` | Importa `../server.js`, podendo acionar bootstrap/efeitos colaterais de inicialização do servidor. | **`AUTH-TEST`** *(específico + cautela de bootstrap)* |
| **B4. Escrita/remoção em `backups/`** | 3 | `contributors-api/tests/test_backup_etapa2.ts`, `contributors-api/tests/test_backup_etapa3.ts`, `contributors-api/tests/test_op21_backup_restore_cycle.ts` *(também importa `pool` de `../server.js`)* | Criam e removem arquivos físicos em `backups/` (e `test_op21` acessa o banco). **Proibidos em validação rotineira.** | **`AUTH-OPS`** |

### 3.3. Comandos Operacionais — PROIBIDOS em Validação Rotineira (`AUTH-OPS`)

| Comando | Ação Real | Risco | Autorização |
| :--- | :--- | :--- | :---: |
| `npm run backup --prefix contributors-api` | Executa `tsx scripts/run-backup.ts`. | Gera dump criptografado / acessa banco e armazenamento. | **`AUTH-OPS`** |
| `npm run restore --prefix contributors-api` | Executa `tsx scripts/restore-backup.ts`. | **Destrutivo / sobrescreve dados do banco.** | **`AUTH-OPS`** |
| `npm run postinstall` / `npm install` | Instala/atualiza dependências em `node_modules` e `contributors-api/node_modules`. | Altera árvores de dependências e lockfiles. | **`AUTH-OPS`** |
| `npm run dev` / `npm run start` / `npm run preview` | Sobe processos persistentes de servidor/Vite. | Ocupa porta `3000` / altera runtime ativo. | **`AUTH-OPS`** |

---

## 4. Mapa Objetivo: Arquivo / PB / Padrão → Validação Obrigatória

### 4.1. Comportamentos Protegidos Homologados (`PB-001` a `PB-008`)

| PB | Arquivos Críticos Cobertos | Validação Automatizada Obrigatória (`AUTH-TEST`) | Cobertura |
| :---: | :--- | :--- | :--- |
| **`PB-001`** | `components/modals/ManualIdModal.tsx`, `components/financial/AttachmentPreviewModal.tsx` | `./contributors-api/node_modules/.bin/tsx --test tests/regression/pb001_manual_launch_preview.test.ts` + `npm run lint` | Automatizada (estrutural + contrato) |
| **`PB-002`** | `components/layout/Sidebar.tsx`, `views/ReportsView.tsx`, `components/modals/ManualIdModal.tsx`, `hooks/reconciliation/useTransactionMatcher.ts`, `hooks/reconciliation/useCloudSync.ts` | `./contributors-api/node_modules/.bin/tsx --test tests/regression/pb002_manual_launch_cancellation.test.ts` + `npm run lint` | Automatizada (estrutural + contrato) |
| **`PB-003`** | `components/modals/ManualIdModal.tsx`, `components/financial/ExpenseDocumentUploader.tsx`, `utils/imageOcrReader.ts`, `utils/expenseDocumentParser.ts` | `./contributors-api/node_modules/.bin/tsx --test tests/regression/pb003_document_legibility_rejection.test.ts tests/regression/manual_launch_ocr.test.ts tests/regression/pdf_upload_legibility.test.ts` + `npm run lint` | Automatizada (execução + estrutural) |
| **`PB-004`** | `views/UploadView.tsx`, `hooks/useLiveListSync.ts`, `components/modals/ManualIdModal.tsx`, `services/LaunchService.ts` | `./contributors-api/node_modules/.bin/tsx --test tests/regression/pb004_multibank_and_category_validation.test.ts tests/regression/manual_id_church_selection.test.ts` + `npm run lint` | Automatizada (estrutural + seleção igreja) |
| **`PB-005`** | `components/modals/QuickAttachModal.tsx`, `components/modals/ManualIdModal.tsx`, `components/modals/EditManualTransactionModal.tsx`, `services/expenseAttachmentService.ts`, `contributors-api/server.ts` | `./contributors-api/node_modules/.bin/tsx --test tests/regression/pb005_attachment_persistence_and_anti_wipeout.test.ts` + `npm run lint` (+ `npx tsc -p contributors-api/tsconfig.json --noEmit` se tocar API) | Automatizada (estrutural + contrato) |
| **`PB-006`** | `components/register/PaymentMethodsList.tsx`, `hooks/useReferenceData.ts`, `contributors-api/server.ts`, `types/domain.ts` | `./contributors-api/node_modules/.bin/tsx --test tests/regression/pb006_payment_methods_cloud_persistence.test.ts` + `npm run lint` (+ `npx tsc -p contributors-api/tsconfig.json --noEmit` se tocar API) | Automatizada (estrutural + contrato) |
| **`PB-007`** | `components/modals/ChurchClosingModal.tsx`, `views/LivroCaixaView.tsx`, `contexts/AppContext.tsx`, `services/monthClosingService.ts`, `contributors-api/server.ts` | `./contributors-api/node_modules/.bin/tsx --test tests/regression/pb007_church_closing_balance_transport.test.ts` + `npm run lint` (+ `test_op08_2_*` / `test_op13_*` se tocar fechamento na API) | Automatizada (frontend) + Integração opcional (API) |
| **`PB-008`** | `components/admin/AdminAuditTab.tsx`, `contributors-api/server.ts`, `contributors-api/services/audit.service.ts` | `npx tsc -p contributors-api/tsconfig.json --noEmit` + `./contributors-api/node_modules/.bin/tsx contributors-api/tests/test_audit_route_authorization_etapa5_1.ts` *(integração — exige ambiente ativo)* + `tests/regression/pb005_attachment_persistence_and_anti_wipeout.test.ts` | Integração (API) + Regressão colateral |

### 4.2. Outras Áreas por Domínio

| Área Alterada | Validação Mínima Obrigatória (`AUTH-TEST`) | Observação de Cobertura |
| :--- | :--- | :--- |
| **UI / Padronização Visual (`AGENTS.md` #8–#11)** (`views/`, `components/`, `portal/`) | `npm run lint` + `npm run build` + testes `PB-*` aplicáveis ao arquivo alterado. | **Sem teste automatizado de layout/CSS:** exige conferência visual explícita pelo usuário em desktop e mobile/tablet. |
| **Parsers / Exportação (`core/`, `services/ExportService.ts`, `services/processingService.ts`)** | `npm run lint` + `./contributors-api/node_modules/.bin/tsx contributors-api/tests/test_op14_parsers_robustness.ts` e/ou `test_op17_export_totals_integrity.ts`. | 100% puros em memória. |
| **Backend API (`contributors-api/`)** | `npx tsc -p contributors-api/tsconfig.json --noEmit` + `npm run build --prefix contributors-api` + teste específico do subgrupo B2 correspondente (quando ambiente ativo e autorizado). | `npm run lint` da raiz **não** cobre `contributors-api/`. |
| **Servidor Principal (`server.js`, `backend/`)** | `node --check server.js` (e `node --check` nos `.js` alterados em `backend/`) + `npm run build` (se houver impacto integrado). | Sem suíte unitária dedicada para `server.js`. |
| **Candidatos e Regras Blindadas sem teste dedicado** (`AGENTS.md` #1, #2, #3, #4, #5, #6, #7 / `CANDIDATO-01` a `CANDIDATO-07`) | `npm run lint` + inspeção estática das invariantes no diff + `npm run build`. | **Cobertura automatizada inexistente** até criação futura de testes — reportar obrigatoriamente essa limitação. |

---

## 5. Critérios Objetivos de Classificação Técnica

Toda entrega com alteração de código ou governança deve ser classificada segundo estes critérios rígidos:

### `APROVADO`
Todos os itens aplicáveis abaixo foram comprovados com evidência real na sessão:
1. Alteração estritamente restrita ao escopo autorizado (sem efeito dominó e sem edição fora da propriedade aprovada).
2. Todos os comandos de validação aplicáveis ao domínio alterado foram efetivamente executados e passaram com exit code `0`.
3. Todas as `PB-XXX` potencialmente impactadas foram verificadas pelos seus testes específicos (e nunca apenas por `harness.test.ts`).
4. Nenhuma regressão, aviso bloqueante ou lacuna de validação aplicável permaneceu em aberto.

### `APROVADO COM RESSALVAS`
A alteração está coerente e os checks executáveis aplicáveis passaram, **mas** existe ao menos uma limitação real e explicitamente documentada, por exemplo:
1. A área alterada não possui teste automatizado (ex.: visual/CSS Padrões `#8`–`#11`, `CANDIDATO-01` a `CANDIDATO-07`) e aguarda verificação funcional/visual do usuário.
2. Um teste de integração (subgrupo B2, como `PB-008` ou `test_op09_*`) não pôde ser executado por falta de servidor/PostgreSQL ativo ou por restrição de `AUTH-TEST` / `AUTH-OPS`.
3. A etapa autorizou apenas `AUTH-WRITE` documental sem execução de `AUTH-TEST` (neste caso, indicar claramente o que foi verificado em modo leitura e o que não foi executado).

### `NÃO APROVADO`
Qualquer uma das condições abaixo impede considerar a tarefa concluída ou apta a deploy:
1. Qualquer erro em `npm run lint`, `npx tsc -p contributors-api/tsconfig.json --noEmit`, `node --check` ou `npm run build`.
2. Falha em qualquer teste de `tests/regression/` ou teste de integração aplicável.
3. Violação de regra congelada (`AGENTS.md`), de invariante de `PB-001` a `PB-008` ou de fronteira de segurança/RBAC/multi-tenancy.
4. Alteração feita por hipótese sem causa comprovada, ou tentativa de afrouxar/remover teste de regressão para mascarar falha.
