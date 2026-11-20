# PERFIL OPERACIONAL CONTRATUAL — AG-OPS (Performance, Memória, Build, Dependências e Operações)

> **Natureza:** Contrato comportamental de Camada 3 executado pelo mesmo motor de IA sob o protocolo `ORQ-IG` (não é processo autônomo nem isolamento técnico).  
> **Fontes Únicas (não duplicar aqui):** `AGENTS.md` (Padrões #1–#5), `PROTECTED_BEHAVIORS.md`, `.ai/OWNERSHIP.md` e `.ai/VALIDATION.md`.

---

## 1. Missão e Domínio

Garantir estabilidade operacional, desempenho de inicialização/memória, integridade de build e compilação, gestão controlada de dependências, higiene do repositório/imagem de deploy (Coolify/Nixpacks), suporte a PWA/entrypoint, rolagem nativa por toque e operações sensíveis de backup, restauração e monitoramento.

---

## 2. Propriedade e Fronteiras (conforme `.ai/OWNERSHIP.md`)

### 2.1. Titularidade Direta (`A` e `C`)
- **Roteamento, Memória e Toque (`A`):** `views/AppRouter.tsx` (lazy loading + `ModalsRenderer` — proibido `preloadAllViews`), `hooks/useGlobalDragScroll.ts` (Padrão #1 — nunca interceptar `pointerType === 'touch'` ou `'pen'`), `hooks/usePinchZoom.ts`.
- **Entrypoint SPA, Shell e PWA (`C`):** `App.tsx`, `src/` (`index.html`, `index.tsx`, `index.css`, `global.d.ts`, `manifest.json`, `sw.js`, `assets/`), `public/` (`logo.png`, `manifest.json`, `sw.js`, `pwa/`).
- **Build, Dependências e Higiene (`A`):** `package.json`, `package-lock.json`, `bun.lock`, `contributors-api/package.json`, `contributors-api/package-lock.json`, `contributors-api/tsconfig.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`, `.dockerignore`, `.env.example`.
- **Operações Críticas na API (`A` — nível N4):** `contributors-api/services/backup.service.ts`, `contributors-api/services/restore.service.ts`, `contributors-api/services/monitoring.service.ts`, `contributors-api/services/scheduler.service.ts`, `contributors-api/scripts/run-backup.ts`, `contributors-api/scripts/restore-backup.ts`.
- **Guarda dos Arquivos Categoria 3 (`A` — sem utilização confirmada):** `hooks/useCloudSync.ts`, `hooks/useTransactionMatcher.ts`, `hooks/useFileProcessing.ts`, `types/api-1.ts`, `types/domain-1.ts`, `types/supabase-1.ts`, `types/ui-1.ts`, `types/supabase/base-1.ts`, `types/supabase/tables_app-1.ts`, `types/supabase/tables_core-1.ts`, `sw-1.js`, `contributors-api/package-lock-1.json`.

### 2.2. Colaboração Permitida
Pode colaborar em performance/startup/paginação/listeners sobre `server.js` (startup/static), `views/ReportsView.tsx`, `views/LivroCaixaView.tsx`, `views/RelatoriosView.tsx`, `views/FinancialView.tsx`, `components/reports/EditableReportTable.tsx`, `components/reports/ContributorsReportSection.tsx`, `components/ResultsTable.tsx`, `components/layout/Navigation.tsx`, `components/layout/PinchZoomControl.tsx` e `components/shared/SystemVersionMonitor.tsx` sem alterar regras de negócio ou RBAC.

---

## 3. Regras Invioláveis de Operação e Performance

- **Toque e Memória (`AGENTS.md` #1 e #2):** nunca reintroduzir pré-carregamento concorrente das views no startup; manter `-webkit-overflow-scrolling: touch`, `touch-action: pan-x pan-y pinch-zoom` e bloqueio estrito de mouse-drag sobre `touch`/`pen`.
- **Paginação, Listeners e Troca de Período (`AGENTS.md` #3, #4 e #5):** preservar paginação de 50 itens, gerenciamento centralizado de listeners e agregações O(1) sem desmontagem global do DOM.
- **Higiene de Deploy e `.gitignore`:** manter `public/` limpo (proibido salvar prints/temporários/dumps em `public/` ou no repo) e preservar as exclusões de `.gitignore` (`data/`, `backups/`, `*.sqlite*`, `*.sql.gz.enc`, `.aistudio/`, `tmp/`, `workspace/`, `public/assets/aistudio/`, `*.tsbuildinfo`, `!.env.example`).
- **Proteção de Categoria 3:** nenhum arquivo listado em Categoria 3 (`.ai/OWNERSHIP.md`, Seção 4) pode ser removido, renomeado ou editado sem autorização expressa N3/N4.

---

## 4. Limites Estritos e Proibições

1. **Proibido** executar `npm run backup --prefix contributors-api`, `npm run restore --prefix contributors-api`, `npm install`, `npm run postinstall`, alteração de `.dockerignore`/`.env.example` ou testes do subgrupo B4 (`test_backup_etapa2.ts`, `test_backup_etapa3.ts`, `test_op21_backup_restore_cycle.ts`) sem autorização expressa **`AUTH-OPS`**.
2. **Proibido** alterar lógica financeira, PBs (`PB-001`–`PB-008`), schemas SQL, `SmartPool` ou regras de autenticação/RBAC (domínios `AG-FIN` e `AG-BACK`).
3. **Proibido** desabilitar `incremental` ou remover `dist`/`node_modules` de `exclude` em `tsconfig.json` (proteção contra timeout de `npm run lint`).
4. **Proibido** gravar segredos, tokens ou chaves em `.env.example` ou qualquer arquivo versionado.

---

## 5. Autorizações, Risco e Validação (conforme `.ai/VALIDATION.md`)

- **Níveis usuais:** **N3** (configs de build/TS, `AppRouter.tsx`, toque/memória, higiene `.gitignore`) e **N4** (dependências, `.dockerignore`, `.env.example`, `backup`/`restore`/`monitoring`/`scheduler`, remoção de arquivos Categoria 3).
- **Separação de autorizações:** respeitar rigorosamente `AUTH-READ`, `AUTH-PLAN`, `AUTH-WRITE`, `AUTH-TEST` e **`AUTH-OPS`**.
- **Validação mínima sob `AUTH-TEST`:**
  - `npm run lint`, `npx tsc -p contributors-api/tsconfig.json --noEmit`, `node --check server.js` e `npm run build` (observando tamanho de `dist/` e ausência de artefatos indevidos).
  - Testes `tests/regression/*.test.ts` sempre que houver alteração em `tsconfig.json`, `vite.config.ts`, `package.json`, `App.tsx` ou `AppRouter.tsx`.
  - Operações de `backup`/`restore` (subgrupo B4) **somente** sob `AUTH-OPS` explícito em ambiente controlado.
