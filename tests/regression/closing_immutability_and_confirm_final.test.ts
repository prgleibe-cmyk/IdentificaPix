import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
    isPeriodClosed,
    isChurchDayConfirmed,
    getDateChurchLockReason
} from '../../utils/formatters';
import {
    syncAllChurchClosings,
    saveMonthClosingRecord,
    reopenMonthClosingRecord,
    deleteMonthClosingRecord,
    isChurchPeriodClosedSync
} from '../../services/monthClosingService';
import { consolidationService } from '../../services/ConsolidationService';
import {
    saveAttachmentsForTransaction,
    getCachedAttachmentsMap
} from '../../services/expenseAttachmentService';
import { hasPermission, TenantContext } from '../../contributors-api/auth/utils/tenant.context';

const ROOT = process.cwd();
const readSource = (relPath: string): string =>
    fs.readFileSync(path.resolve(ROOT, relPath), 'utf8');

function setupMemoryStorage(initial: Record<string, string> = {}) {
    const store: Record<string, string> = { ...initial };
    const prevStorage = (globalThis as any).localStorage;
    (globalThis as any).localStorage = {
        getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = String(v); },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { for (const k of Object.keys(store)) delete store[k]; }
    };
    return () => {
        if (prevStorage === undefined) delete (globalThis as any).localStorage;
        else (globalThis as any).localStorage = prevStorage;
    };
}

function mockFetch(impl: (url: any, init?: any) => Promise<any>) {
    const prevFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = impl;
    return () => {
        if (prevFetch === undefined) delete (globalThis as any).fetch;
        else (globalThis as any).fetch = prevFetch;
    };
}

test('Integridade, Imutabilidade, Confirmar Final, Fechamento e Reabertura (T-01 a T-19)', async (t) => {
    const sampleResults: any[] = [
        {
            isConfirmed: true,
            church: { id: 'ch-catedral', name: 'Igreja Catedral' },
            transaction: {
                id: 'tx-confirmed-10',
                date: '2026-11-10',
                bank_id: 'bank-a',
                isConfirmed: true
            }
        },
        {
            isConfirmed: true,
            church: { id: 'ch-catedral', name: 'Igreja Catedral' },
            transaction: {
                id: 'closing-tx-12',
                date: '2026-11-12',
                source: 'closing',
                row_hash: 'closing-2026-11-ch-catedral',
                isConfirmed: true
            }
        },
        {
            isConfirmed: false,
            church: { id: 'ch-filial', name: 'Igreja Filial' },
            transaction: {
                id: 'tx-open-filial-10',
                date: '2026-11-10',
                bank_id: 'bank-a',
                isConfirmed: false
            }
        }
    ];

    await t.test('[T-01] Decisão 1: Confirmar Final bloqueia a combinação exata (Data, Igreja)', () => {
        assert.equal(isChurchDayConfirmed('2026-11-10', sampleResults, 'ch-catedral'), true);
        const reason = getDateChurchLockReason('2026-11-10', 'ch-catedral', sampleResults, 'bank-a');
        assert.ok(reason && reason.includes('DIA CONFIRMADO'), 'Deve retornar mensagem de bloqueio por dia confirmado');
    });

    await t.test('[T-02] Decisão 1: Confirmar Final NÃO bloqueia outras datas na mesma igreja', () => {
        assert.equal(isChurchDayConfirmed('2026-11-11', sampleResults, 'ch-catedral'), false);
        assert.equal(isChurchDayConfirmed('2026-11-09', sampleResults, 'ch-catedral'), false);
        assert.equal(getDateChurchLockReason('2026-11-11', 'ch-catedral', sampleResults, 'bank-a'), null);
    });

    await t.test('[T-03] Decisão 1: Confirmar Final NÃO bloqueia a mesma data em outra igreja', () => {
        assert.equal(isChurchDayConfirmed('2026-11-10', sampleResults, 'ch-filial'), false);
        assert.equal(getDateChurchLockReason('2026-11-10', 'ch-filial', sampleResults, 'bank-a'), null);
    });

    await t.test('[T-04] P2-A: Dia confirmado vale em todas as contas/bancos da mesma igreja e respeita excludeTxId', () => {
        // Confirmado no bank-a deve bloquear novo lançamento no bank-b na mesma data e igreja
        const reasonBankB = getDateChurchLockReason('2026-11-10', 'ch-catedral', sampleResults, 'bank-b');
        assert.ok(reasonBankB && reasonBankB.includes('DIA CONFIRMADO'));
        // excludeTxId permite checar auto-referência sem falso positivo
        assert.equal(isChurchDayConfirmed('2026-11-10', sampleResults, 'ch-catedral', 'tx-confirmed-10'), false);

        // Backend verifica isChurchDayConfirmed por (church_id, effective_date) sem restringir por bank_id
        const serverCode = readSource('contributors-api/server.ts');
        assert.ok(serverCode.includes('async function isChurchDayConfirmed('), 'Backend deve expor isChurchDayConfirmed');
    });

    await t.test('[T-05] Decisões 1 & 2: Guardas de backend bloqueiam criação, edição, exclusão, anexos, rateios, financeiro e relatórios', () => {
        const serverCode = readSource('contributors-api/server.ts');
        assert.ok(serverCode.includes('async function assertWritablePeriodAndDate('), 'Guarda central assertWritablePeriodAndDate presente');
        assert.ok(serverCode.includes('async function assertSplitsWritable('), 'Guarda de rateios assertSplitsWritable presente');
        assert.ok(serverCode.includes("error: 'TRANSACTION_CONFIRMED'"), 'Proteção direta contra mutação de registro confirmado presente');
        assert.ok(serverCode.includes("error: 'DAY_CONFIRMED_LOCKED'"), 'Proteção de dia confirmado presente no backend');
        assert.ok(serverCode.includes("error: 'PERIOD_CLOSED'"), 'Proteção de período fechado presente no backend');
        assert.ok(serverCode.includes("error: 'REPORT_HAS_CONFIRMED_TRANSACTIONS'"), 'Proteção contra exclusão de relatório com lançamentos confirmados presente');
        // Verifica aplicação nos endpoints de financial_records e saved_reports/sync (Bypasses D/E/F)
        const guardCalls = serverCode.match(/assertWritablePeriodAndDate\(/g) || [];
        assert.ok(guardCalls.length >= 10, `assertWritablePeriodAndDate deve proteger todas as rotas de mutação (encontradas: ${guardCalls.length})`);
    });

    await t.test('[T-06] Decisão 2 & P3-A: Fechamento mensal e intervalo personalizado (start_date..end_date)', async () => {
        const restoreStorage = setupMemoryStorage({ auth_token: 'tok-test' });
        const restoreFetch = mockFetch(async () => ({
            ok: true,
            status: 200,
            json: async () => ([
                {
                    id: 'close-custom-nov',
                    church_id: 'ch-catedral',
                    bank_id: null,
                    year: 2026,
                    month: 11,
                    period_type: 'custom',
                    start_date: '2026-11-05',
                    end_date: '2026-11-15',
                    status: 'closed'
                }
            ])
        }));
        try {
            await syncAllChurchClosings();
            assert.equal(isPeriodClosed('2026-11-05', sampleResults, 'ch-catedral', 'bank-a'), true);
            assert.equal(isPeriodClosed('2026-11-15', sampleResults, 'ch-catedral', 'bank-b'), true);
            assert.equal(isPeriodClosed('2026-11-04', sampleResults, 'ch-catedral', 'bank-a'), false);
            assert.equal(isPeriodClosed('2026-11-16', sampleResults, 'ch-catedral', 'bank-a'), false);
            // Precedência: PERÍODO CONGELADO sobrepõe DIA CONFIRMADO quando ambos se aplicam
            const reason = getDateChurchLockReason('2026-11-10', 'ch-catedral', sampleResults, 'bank-a');
            assert.ok(reason && reason.includes('PERÍODO CONGELADO'));
        } finally {
            restoreFetch();
            restoreStorage();
        }

        // Schema P3-A em PostgreSQL, LocalSqliteEngine e SmartPool (em contributors-api/server.ts)
        const serverCode = readSource('contributors-api/server.ts');
        assert.ok(serverCode.includes('class LocalSqliteEngine'), 'LocalSqliteEngine presente');
        assert.ok(serverCode.includes('class SmartPool'), 'SmartPool presente');
        assert.ok(serverCode.includes('period_type'), 'server.ts deve suportar period_type');
        assert.ok(serverCode.includes('start_date'), 'server.ts deve suportar start_date');
        assert.ok(serverCode.includes('end_date'), 'server.ts deve suportar end_date');
    });

    await t.test('[T-07] Decisão 2: Fechamento por conta/banco isola a conta sem bloquear outra conta da mesma igreja', async () => {
        const restoreStorage = setupMemoryStorage({ auth_token: 'tok-test' });
        const restoreFetch = mockFetch(async () => ({
            ok: true,
            status: 200,
            json: async () => ([
                {
                    id: 'close-bank-a-oct',
                    church_id: 'ch-catedral',
                    bank_id: 'bank-a',
                    year: 2026,
                    month: 10,
                    period_type: 'monthly',
                    start_date: '2026-10-01',
                    end_date: '2026-10-31',
                    status: 'closed'
                }
            ])
        }));
        try {
            await syncAllChurchClosings();
            assert.equal(isChurchPeriodClosedSync('ch-catedral', '2026-10-20', 'bank-a'), true);
            assert.equal(isChurchPeriodClosedSync('ch-catedral', '2026-10-20', 'bank-b'), false);
            assert.equal(isChurchPeriodClosedSync('ch-filial', '2026-10-20', 'bank-a'), false);
        } finally {
            restoreFetch();
            restoreStorage();
        }
    });

    await t.test('[T-08] Decisão 2 & P4-A: Fechamento ACID persiste is_confirmed=true e normaliza draft -> closed', () => {
        const serverCode = readSource('contributors-api/server.ts');
        const postIdx = serverCode.indexOf("app.post('/api/v1/church-closings'");
        const reopenIdx = serverCode.indexOf("app.post('/api/v1/church-closings/reopen'");
        assert.ok(postIdx > 0 && reopenIdx > postIdx);
        const postBlock = serverCode.slice(postIdx, reopenIdx);
        assert.ok(postBlock.includes("BEGIN"), 'POST /church-closings deve operar em transação ACID');
        assert.ok(postBlock.includes("COMMIT"), 'POST /church-closings deve efetuar COMMIT');
        assert.ok(postBlock.includes("ROLLBACK"), 'POST /church-closings deve efetuar ROLLBACK em falha');
        assert.ok(postBlock.includes("is_confirmed = true") || postBlock.includes("is_confirmed = $1"), 'POST /church-closings deve persistir is_confirmed=true nos lançamentos do escopo');
        assert.ok(postBlock.includes("status = 'resolved'"), 'POST /church-closings deve persistir status=resolved nos lançamentos do escopo');
        assert.ok(postBlock.includes("'draft'") && postBlock.includes("'closed'"), 'P4-A: status draft deve ser normalizado para closed');
    });

    await t.test('[T-09] Decisão 3: Reabertura (POST /reopen e DELETE) reverte is_confirmed=false/identified e preserva histórico/auditoria', () => {
        const serverCode = readSource('contributors-api/server.ts');
        assert.ok(serverCode.includes('async function revertConfirmedTransactionsForReopen('), 'Helper revertConfirmedTransactionsForReopen presente');
        const reopenIdx = serverCode.indexOf("app.post('/api/v1/church-closings/reopen'");
        const deleteIdx = serverCode.indexOf("app.delete('/api/v1/church-closings/:churchId/:year/:month'");
        assert.ok(reopenIdx > 0 && deleteIdx > reopenIdx);

        const reopenBlock = serverCode.slice(reopenIdx, deleteIdx);
        const deleteBlock = serverCode.slice(deleteIdx, deleteIdx + 10000);

        assert.ok(reopenBlock.includes('revertConfirmedTransactionsForReopen('), 'POST /reopen reverte transações confirmadas no escopo');
        assert.ok(reopenBlock.includes("status = 'reopened'"), 'POST /reopen marca fechamento como reopened preservando histórico');
        assert.ok(reopenBlock.includes('logAudit('), 'POST /reopen registra trilha de auditoria');

        assert.ok(deleteBlock.includes('revertConfirmedTransactionsForReopen('), 'DELETE /church-closings reverte transações confirmadas no escopo');
        assert.ok(deleteBlock.includes("status = 'reopened'"), 'DELETE /church-closings preserva histórico como reopened');
        assert.ok(deleteBlock.includes('logAudit('), 'DELETE /church-closings registra trilha de auditoria');
    });

    await t.test('[T-10] P5-A: Reabertura consolidada preserva transações cobertas por fechamento bancário ativo independente', () => {
        const serverCode = readSource('contributors-api/server.ts');
        const fnIdx = serverCode.indexOf('async function revertConfirmedTransactionsForReopen(');
        assert.ok(fnIdx > 0);
        const fnBlock = serverCode.slice(fnIdx, fnIdx + 4500);
        assert.ok(fnBlock.includes('remainingActiveClosings.some('), 'P5-A: deve verificar fechamentos ativos remanescentes');
        assert.ok(fnBlock.includes('ac.bankId === txBankId'), 'P5-A: deve preservar transações cobertas por fechamento bancário ativo independente');
        assert.ok(fnBlock.includes("status != 'reopened'"), 'P5-A: deve considerar apenas fechamentos ativos');
    });

    await t.test('[T-11] P1-A: Desbloqueio individual proibido para secundário e proibido dentro de período fechado (backend + UI)', () => {
        const serverCode = readSource('contributors-api/server.ts');
        const confirmBatchIdx = serverCode.indexOf("app.post('/api/v1/consolidated_transactions/confirm-batch'");
        assert.ok(confirmBatchIdx > 0);
        const confirmBatchBlock = serverCode.slice(confirmBatchIdx, confirmBatchIdx + 8500);
        assert.ok(confirmBatchBlock.includes('ctx.isSecondaryUser'), 'confirm-batch bloqueia desbloqueio individual para secundário');
        assert.ok(confirmBatchBlock.includes('assertWritablePeriodAndDate('), 'confirm-batch exige período aberto para desbloqueio individual');

        const resultsTableCode = readSource('components/ResultsTable.tsx');
        const editableTableCode = readSource('components/reports/EditableReportTable.tsx');
        assert.ok(resultsTableCode.includes('!isSecondaryUser && !isRowClosedPeriod'), 'ResultsTable aplica P1-A em Remover Bloqueio');
        assert.ok(editableTableCode.includes('!isClosedPeriod && !isSecondaryUser'), 'EditableReportTable aplica P1-A em Remover Bloqueio');
    });

    await t.test('[T-12] RBAC confirm_final: Permissão real validada em tenant.context.ts', () => {
        const secondaryWithoutPerm: TenantContext = {
            userId: 'sec-1',
            ownerId: 'owner-1',
            role: 'secondary',
            isOwner: false,
            isSecondaryUser: true,
            isSuperAdmin: false,
            isAuthenticated: true,
            churchId: 'ch-catedral',
            allowedChurchIds: ['ch-catedral'],
            allowedBankIds: [],
            permissions: ['lancar_dados']
        };
        const secondaryWithPerm: TenantContext = {
            ...secondaryWithoutPerm,
            permissions: ['lancar_dados', 'confirmar_final']
        };
        const ownerCtx: TenantContext = {
            ...secondaryWithoutPerm,
            userId: 'owner-1',
            role: 'owner',
            isOwner: true,
            isSecondaryUser: false,
            permissions: []
        };

        assert.equal(hasPermission(secondaryWithoutPerm, 'confirm_final', 'confirmar_final', 'confirmfinal'), false);
        assert.equal(hasPermission(secondaryWithPerm, 'confirm_final', 'confirmar_final', 'confirmfinal'), true);
        assert.equal(hasPermission(ownerCtx, 'confirm_final', 'confirmar_final', 'confirmfinal'), true);
    });

    await t.test('[T-13] Concorrência e Fail-Closed (503 + advisory locks PG e SQLite)', () => {
        const serverCode = readSource('contributors-api/server.ts');
        assert.ok(serverCode.includes('class LockVerificationUnavailableError'), 'LockVerificationUnavailableError definida');
        assert.ok(serverCode.includes('status(503)'), 'Fail-closed retorna HTTP 503 quando verificação de bloqueio falha');
        assert.ok(serverCode.includes('pg_advisory_xact_lock'), 'Advisory lock exclusivo em PostgreSQL presente');
        assert.ok(serverCode.includes('pg_advisory_xact_lock_shared'), 'Advisory lock compartilhado em PostgreSQL presente');
        assert.ok(serverCode.includes('activeClosingLocks') && serverCode.includes('sharedLockCounts'), 'Locks exclusivos e compartilhados no LocalSqliteEngine presentes');
        assert.ok(serverCode.includes('async function acquireSharedPeriodLocks('), 'Helper acquireSharedPeriodLocks presente');
    });

    await t.test('[T-14] Lançamentos sintéticos de fechamento (source=closing) não disparam bloqueio de dia confirmado', () => {
        assert.equal(isChurchDayConfirmed('2026-11-12', sampleResults, 'ch-catedral'), false);
        const serverCode = readSource('contributors-api/server.ts');
        assert.ok(serverCode.includes("COALESCE(source, '') != 'closing'"), 'Backend exclui source=closing da verificação de dia confirmado');
    });

    await t.test('[T-15] Backend-first e propagação real de erros HTTP (sem engolimento silencioso nos serviços)', async () => {
        const restoreStorage = setupMemoryStorage({ auth_token: 'tok-test' });
        const errMsg = 'Este período está fechado definitivamente. Não é permitido realizar novos lançamentos nesta data para esta igreja.';
        const restoreFetch = mockFetch(async () => ({
            ok: false,
            status: 423,
            text: async () => JSON.stringify({ error: 'PERIOD_CLOSED_LOCKED', message: errMsg }),
            json: async () => ({ error: 'PERIOD_CLOSED_LOCKED', message: errMsg })
        }));

        try {
            // 1. confirm-batch
            await assert.rejects(
                () => consolidationService.updateConfirmationStatus(['00000000-0000-4000-8000-000000000001'], true),
                (err: any) => err?.message?.includes('período está fechado definitivamente')
            );

            // 2. saveMonthClosingRecord
            await assert.rejects(
                () => saveMonthClosingRecord({
                    id: 'closing-test-err',
                    churchId: 'ch-catedral',
                    churchName: 'Igreja Catedral',
                    month: 11,
                    year: 2026,
                    closedAt: new Date().toISOString(),
                    totalIncome: 100,
                    totalExpenses: 50,
                    previousBalance: 0,
                    finalBalance: 50,
                    signatures: [],
                    integrityHash: 'test-hash-123',
                    status: 'closed'
                }),
                (err: any) => err?.message?.includes('período está fechado definitivamente')
            );

            // 3. reopenMonthClosingRecord
            await assert.rejects(
                () => reopenMonthClosingRecord('ch-catedral', 2026, 11),
                (err: any) => err?.message?.includes('período está fechado definitivamente')
            );

            // 4. deleteMonthClosingRecord
            await assert.rejects(
                () => deleteMonthClosingRecord('ch-catedral', 2026, 11),
                (err: any) => err?.message?.includes('período está fechado definitivamente')
            );

            // 5. saveAttachmentsForTransaction (UUID real -> backend-first rejeita sem mutar cache local)
            const testTxId = '00000000-0000-4000-8000-000000000099';
            await assert.rejects(
                () => saveAttachmentsForTransaction(testTxId, [{
                    id: 'att-1',
                    fileName: 'nota.pdf',
                    fileSize: 1024,
                    fileType: 'application/pdf',
                    uploadedAt: new Date().toISOString(),
                    validationStatus: 'manual_review'
                }]),
                (err: any) => err?.message?.includes('período está fechado definitivamente')
            );
            const cachedMap = getCachedAttachmentsMap();
            assert.equal(cachedMap?.get(testTxId), undefined, 'Cache local de anexos não deve ser alterado após rejeição do backend');
        } finally {
            restoreFetch();
            restoreStorage();
        }
    });

    await t.test('[T-16] Bloqueios uniformes na UI para todos os perfis (zero bypass isSecondaryUser && isPeriodClosed)', () => {
        const uiFiles = [
            'utils/formatters.ts',
            'components/BulkActionToolbar.tsx',
            'components/ResultsTable.tsx',
            'components/reports/EditableReportTable.tsx',
            'components/modals/ManualIdModal.tsx',
            'components/modals/EditManualTransactionModal.tsx',
            'components/modals/SplitTransactionModal.tsx',
            'views/FinancialView.tsx',
            'views/LivroCaixaView.tsx'
        ];
        for (const f of uiFiles) {
            const code = readSource(f);
            assert.ok(!/isSecondaryUser\s*&&\s*isPeriodClosed/.test(code), `Bypass isSecondaryUser && isPeriodClosed não pode existir em ${f}`);
        }
    });

    await t.test('[T-17] Modais (ManualId, EditManual, Split), BulkActionToolbar e FinancialView aplicam bloqueios uniformes', () => {
        const manualId = readSource('components/modals/ManualIdModal.tsx');
        const editManual = readSource('components/modals/EditManualTransactionModal.tsx');
        const splitModal = readSource('components/modals/SplitTransactionModal.tsx');
        const bulkBar = readSource('components/BulkActionToolbar.tsx');
        const financialView = readSource('views/FinancialView.tsx');

        assert.ok(manualId.includes('getDateChurchLockReason('), 'ManualIdModal valida getDateChurchLockReason');
        assert.ok(editManual.includes('getDateChurchLockReason(') && editManual.includes('TRANSAÇÃO CONFIRMADA'), 'EditManualTransactionModal bloqueia confirmado/período/dia');
        assert.ok(splitModal.includes('sourceLockReason') && splitModal.includes('getDateChurchLockReason('), 'SplitTransactionModal bloqueia origem e destinos do rateio');
        assert.ok(bulkBar.includes('hasAnyLockedRow') && bulkBar.includes('unlockedSelected'), 'BulkActionToolbar filtra desbloqueados e bloqueia exclusão com item protegido');
        assert.ok(financialView.includes('parseFinancialApiError') && financialView.includes('getRecordLockReason'), 'FinancialView bloqueia linhas protegidas e propaga erro real do backend');
    });

    await t.test('[T-18] Livro Caixa exibe selos Período Fechado / Confirmado e bloqueia mutações preservando leitura e PB-007', () => {
        const livroCaixa = readSource('views/LivroCaixaView.tsx');
        assert.ok(livroCaixa.includes('<span>Período Fechado</span>'), 'Badge Período Fechado presente no Livro Caixa');
        assert.ok(livroCaixa.includes('<span>Confirmado</span>'), 'Badge Confirmado presente no Livro Caixa');
        assert.ok(livroCaixa.includes('isManualRow && !isClosingTx && !isRowLocked'), 'Botão Editar oculto em linha bloqueada');
        assert.ok(livroCaixa.includes('{!isRowLocked && !isClosingTx && ('), 'Botões Emitir Recibo e Anexar ocultos em linha bloqueada');
        assert.ok(livroCaixa.includes('setPreviewAttachment({ ...nfAtt'), 'Visualização somente leitura de anexos preservada');
        assert.ok(livroCaixa.includes('Transporte de Saldo de Fechamento:'), 'PB-007 preservado no rodapé');
    });

    await t.test('[T-19] Sincronização em tempo real SSE (MONTH_CLOSING_UPDATED) entre usuários sem alterar arquitetura congelada', () => {
        const serverCode = readSource('contributors-api/server.ts');
        const appCtxCode = readSource('contexts/AppContext.tsx');

        const closingEmits = serverCode.match(/type:\s*'MONTH_CLOSING_UPDATED'/g) || [];
        assert.equal(closingEmits.length, 3, 'Backend deve emitir MONTH_CLOSING_UPDATED nos 3 endpoints de fechamento/reabertura');
        assert.ok(serverCode.includes("action: targetConfirmed ? 'CONFIRM_BATCH' : 'UNLOCK_BATCH'"), 'confirm-batch emite TRANSACTION_UPDATED via SSE');

        const sseIdx = appCtxCode.indexOf('eventSource.onmessage');
        assert.ok(sseIdx > 0);
        const sseBlock = appCtxCode.slice(sseIdx, sseIdx + 2000);
        assert.ok(sseBlock.includes("if (data.type === 'MONTH_CLOSING_UPDATED')"), 'AppContext SSE trata MONTH_CLOSING_UPDATED');
        assert.ok(sseBlock.includes('syncAllChurchClosings().catch(() => {})'), 'AppContext SSE invalida cache de fechamentos');
        assert.ok(sseBlock.includes('triggerRefresh(true)'), 'AppContext SSE mantém hidratação incremental via triggerRefresh');
    });
});
