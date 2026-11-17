import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * HARNESS DE INFRAESTRUTURA GERAL DO PROTOCOLO
 * 
 * ATENÇÃO: Este teste valida unicamente a infraestrutura do protocolo,
 * contratos estruturais e mecanismos base de teste.
 * 
 * ELE NÃO SUBSTITUI E NÃO SERVE ISOLADAMENTE COMO EVIDÊNCIA DE QUE UMA
 * PB-XXX ESPECÍFICA ESTÁ PROTEGIDA. Cada PB futura exige seus próprios
 * testes executáveis vinculados por rastreabilidade direta:
 * PB-XXX → Comportamento → Invariantes → Teste específico → Resultado.
 */
test('Infraestrutura de Proteção contra Regressão - Validação de Integridade', async (t) => {
  await t.test('O arquivo central de comportamentos protegidos deve existir e ser legível', () => {
    const pbPath = resolve(process.cwd(), 'PROTECTED_BEHAVIORS.md');
    assert.ok(existsSync(pbPath), 'PROTECTED_BEHAVIORS.md não encontrado na raiz do projeto');
    
    const content = readFileSync(pbPath, 'utf-8');
    assert.ok(content.includes('REGISTRO CENTRAL DE COMPORTAMENTOS PROTEGIDOS'), 'Cabeçalho ausente');
    assert.ok(content.includes('Gate Obrigatório de Não-Regressão e Fluxo Pós-Aprovação Completo'), 'Fluxo pós-aprovação ausente');
    assert.ok(content.includes('Distinção entre Harness de Infraestrutura e Testes Específicos de PB'), 'Distinção de harness ausente');
    assert.ok(content.includes('PROTEGIDA'), 'Status PROTEGIDA ausente');
    assert.ok(content.includes('PROTEÇÃO PARCIAL'), 'Status PROTEÇÃO PARCIAL ausente');
    assert.ok(content.includes('NÃO PROTEGIDA'), 'Status NÃO PROTEGIDA ausente');
  });

  await t.test('PBs homologadas devem possuir estrutura completa de PB-001 a PB-008', () => {
    const pbPath = resolve(process.cwd(), 'PROTECTED_BEHAVIORS.md');
    const content = readFileSync(pbPath, 'utf-8');
    // PB-001 a PB-008 formalmente aprovadas em PROTECTED_BEHAVIORS.md
    assert.ok(content.includes('### [PB-001]'), 'PB-001 não encontrada em PROTECTED_BEHAVIORS.md');
    assert.ok(content.includes('### [PB-002]'), 'PB-002 não encontrada em PROTECTED_BEHAVIORS.md');
    assert.ok(content.includes('### [PB-003]'), 'PB-003 não encontrada em PROTECTED_BEHAVIORS.md');
    assert.ok(content.includes('### [PB-004]'), 'PB-004 não encontrada em PROTECTED_BEHAVIORS.md');
    assert.ok(content.includes('### [PB-005]'), 'PB-005 não encontrada em PROTECTED_BEHAVIORS.md');
    assert.ok(content.includes('### [PB-006]'), 'PB-006 não encontrada em PROTECTED_BEHAVIORS.md');
    assert.ok(content.includes('### [PB-007]'), 'PB-007 não encontrada em PROTECTED_BEHAVIORS.md');
    assert.ok(content.includes('### [PB-008]'), 'PB-008 não encontrada em PROTECTED_BEHAVIORS.md');
  });

  await t.test('AGENTS.md deve conter protocolo de ajustes cirúrgicos e registro de funcionalidades blindadas', () => {
    const agentsPath = resolve(process.cwd(), 'AGENTS.md');
    assert.ok(existsSync(agentsPath), 'AGENTS.md não encontrado na raiz do projeto');
    
    const content = readFileSync(agentsPath, 'utf-8');
    assert.ok(content.includes('PROTOCOLO DE AJUSTES CIRÚRGICOS E REGRA PERMANENTE DE DESENVOLVIMENTO'), 'Protocolo ausente em AGENTS.md');
    assert.ok(content.includes('PROTEÇÃO ABSOLUTA DO QUE JÁ FUNCIONA'), 'Proteção absoluta ausente em AGENTS.md');
    assert.ok(content.includes('REGISTRO DE FUNCIONALIDADES CONSOLIDADAS E BLINDADAS'), 'Registro de blindagem ausente em AGENTS.md');
  });

  await t.test('Validação de Invariante Estrutural: ArrayBuffer não deve ser consumido destrutivamente', () => {
    const buffer = new ArrayBuffer(128);
    const slice = buffer.slice(0);
    assert.equal(buffer.byteLength, 128);
    assert.equal(slice.byteLength, 128);
    assert.notEqual(buffer, slice);
  });
});

