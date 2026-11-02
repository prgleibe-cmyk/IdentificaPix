import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 🛡️ TESTES DE REGRESSÃO ESPECÍFICOS: PB-006
 * 
 * RASTREABILIDADE TÉCNICA:
 * PB-006 → Persistência Real em Nuvem e Anti-Perda de Cadastros de Formas de Pagamento e Recebimento
 * 
 * INVARIANTES COMPORTAMENTAIS:
 *   - IC-1: O backend possui tabela e rotas REST para formas de pagamento (GET, POST, PUT, DELETE /api/v1/payment-methods).
 *   - IC-2: O hook useReferenceData busca e sincroniza as formas de pagamento diretamente do servidor em nuvem.
 *   - IC-3: useReferenceData não possui lógica destrutiva de expurgo de formas de pagamento cadastradas.
 *   - IC-4: PaymentMethodsList persiste adições, atualizações e exclusões diretamente no backend em nuvem.
 *   - IC-5: A sincronização em tempo real (payment_methods_updated) propaga as alterações entre abas e instâncias.
 */
test('PB-006: Persistência Real em Nuvem e Anti-Perda de Cadastros de Formas de Pagamento e Recebimento', async (t) => {
  const serverPath = resolve(process.cwd(), 'contributors-api/server.ts');
  const refDataPath = resolve(process.cwd(), 'hooks/useReferenceData.ts');
  const paymentListPath = resolve(process.cwd(), 'components/register/PaymentMethodsList.tsx');
  const domainPath = resolve(process.cwd(), 'types/domain.ts');

  assert.ok(existsSync(serverPath), 'contributors-api/server.ts não encontrado');
  assert.ok(existsSync(refDataPath), 'hooks/useReferenceData.ts não encontrado');
  assert.ok(existsSync(paymentListPath), 'components/register/PaymentMethodsList.tsx não encontrado');
  assert.ok(existsSync(domainPath), 'types/domain.ts não encontrado');

  const serverContent = readFileSync(serverPath, 'utf-8');
  const refDataContent = readFileSync(refDataPath, 'utf-8');
  const paymentListContent = readFileSync(paymentListPath, 'utf-8');
  const domainContent = readFileSync(domainPath, 'utf-8');

  await t.test('[BACKEND] Rotas REST e Tabelas SQLite e PostgreSQL para payment_methods', () => {
    // 1. Tabela SQLite
    assert.ok(
      serverContent.includes('CREATE TABLE IF NOT EXISTS payment_methods'),
      'server.ts não define tabela payment_methods para persistência local e nuvem'
    );

    // 2. Rotas REST
    assert.ok(
      serverContent.includes("app.get('/api/v1/payment-methods'"),
      'server.ts não implementa GET /api/v1/payment-methods'
    );
    assert.ok(
      serverContent.includes("app.post('/api/v1/payment-methods'"),
      'server.ts não implementa POST /api/v1/payment-methods'
    );
    assert.ok(
      serverContent.includes("app.put('/api/v1/payment-methods/:id'"),
      'server.ts não implementa PUT /api/v1/payment-methods/:id'
    );
    assert.ok(
      serverContent.includes("app.delete('/api/v1/payment-methods/:id'"),
      'server.ts não implementa DELETE /api/v1/payment-methods/:id'
    );
  });

  await t.test('[FRONTEND] useReferenceData busca e persiste em nuvem com sincronização em tempo real', () => {
    // 1. Chamada fetchPaymentMethods com api em nuvem
    assert.ok(
      refDataContent.includes('/api/v1/payment-methods'),
      'useReferenceData não consulta endpoint em nuvem /api/v1/payment-methods'
    );
    assert.ok(
      refDataContent.includes('fetchPaymentMethods'),
      'useReferenceData não exporta fetchPaymentMethods'
    );

    // 2. addPaymentMethod envia POST para o backend
    assert.ok(
      refDataContent.includes("fetch('/api/v1/payment-methods', {"),
      'addPaymentMethod não executa POST para persistir no backend'
    );

    // 3. Ausência de exclusão indevida em migração legada
    assert.ok(
      !refDataContent.includes("const oldMethods = ['TED', 'BOLETO', 'CARTÃO', 'CHEQUE', 'DEPÓSITO']"),
      'useReferenceData ainda contém lógica destrutiva de expurgo de formas de pagamento legadas'
    );

    // 4. Disparo de eventos realtime
    assert.ok(
      refDataContent.includes("'payment_methods_updated'"),
      'useReferenceData não propaga evento payment_methods_updated'
    );
  });

  await t.test('[UI] PaymentMethodsList salva diretamente na nuvem e sincroniza com AppContext', () => {
    // 1. Sincronização com paymentMethodItems da nuvem
    assert.ok(
      paymentListContent.includes('paymentMethodItems'),
      'PaymentMethodsList não consome paymentMethodItems do AppContext'
    );

    // 2. handleSubmit aciona métodos assíncronos do backend
    assert.ok(
      paymentListContent.includes('await updatePaymentMethod(editingDetail.id, payload)'),
      'PaymentMethodsList não atualiza via updatePaymentMethod na nuvem'
    );
    assert.ok(
      paymentListContent.includes('await addPaymentMethod(payload)'),
      'PaymentMethodsList não cadastra via addPaymentMethod na nuvem'
    );
    assert.ok(
      paymentListContent.includes('await removePaymentMethod(targetId)'),
      'PaymentMethodsList não remove via removePaymentMethod na nuvem'
    );
  });

  await t.test('[TIPAGEM] PaymentMethodItem e PaymentOperationType exportados em domain.ts', () => {
    assert.ok(
      domainContent.includes('export interface PaymentMethodItem'),
      'types/domain.ts não exporta interface PaymentMethodItem'
    );
    assert.ok(
      domainContent.includes('export type PaymentOperationType'),
      'types/domain.ts não exporta tipo PaymentOperationType'
    );
  });
});
