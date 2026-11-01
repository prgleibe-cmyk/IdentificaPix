# REGISTRO CENTRAL DE COMPORTAMENTOS PROTEGIDOS (PROTECTED BEHAVIORS)
**Projeto:** IgGestor / IdentificaPix  
**Fonte da Verdade:** `/PROTECTED_BEHAVIORS.md`  
**Data de Criação:** 28 de Outubro de 2026  
**Status do Protocolo:** ATIVO E VIGENTE  

---

## 1. Princípio Fundamental
Este registro formaliza o **Protocolo Permanente de Desenvolvimento Seguro e Proteção Contra Regressões**.

* **Diferenciação Crítica:** Código pode ser refatorado, otimizado e reestruturado; **COMPORTAMENTOS APROVADOS e suas INVARIANTES COMPORTAMENTAIS são protegidos contra regressão**.
* **Regra Inegociável:** Nenhum novo ajuste pode ser considerado concluído se introduzir regressão em um comportamento anteriormente protegido.
* **Fluxo de Aprovação Humana:** Novas PBs são registradas **somente** após a confirmação explícita do usuário: `"TESTADO E APROVADO"`. Candidatos a proteção não são considerados homologados sem esse aval explícito.
* **Separação Rigorosa de Conceitos (Distinção entre Harness de Infraestrutura e Testes Específicos de PB):**
  1. **PB HOMOLOGADA:** Comportamento formalmente aprovado pelo usuário com "TESTADO E APROVADO".
  2. **CANDIDATO A PROTEÇÃO:** Funcionalidade crítica mapeada e estabilizada, mas ainda não homologada formalmente pelo usuário.
  3. **HARNESS ESTRUTURAL:** Teste de infraestrutura/protocolo (`tests/regression/harness.test.ts`), que valida contratos gerais e mecanismos base, mas NÃO comprova isoladamente que uma PB específica está protegida.

### 1.1 Invariante Comportamental vs. Guarda Estrutural
Para não congelar desnecessariamente detalhes técnicos substituíveis de implementação, o protocolo divide as garantias em dois níveis:

* **A) INVARIANTE COMPORTAMENTAL:**
  - Representa aquilo que o usuário efetivamente experimentou, validou e aprovou.
  - É a regra funcional e observável que **NÃO pode sofrer regressão** sem autorização explícita do usuário.
  - Exemplos: o usuário consegue visualizar o anexo pelo controle VER no chip; não existem controles redundantes de visualização; abrir e fechar o preview preserva intactos os dados preenchidos; o preview sobrepõe visualmente a interface necessária.

* **B) GUARDA ESTRUTURAL / IMPLEMENTAÇÃO ATUAL:**
  - Representa a solução técnica ou detalhe arquitetural atualmente empregado para sustentar a invariante comportamental.
  - Exemplos: localização exata do JSX dentro de um bloco condicional, nome interno de funções/props, chamadas como `setPreviewAttachment(att)`, classe CSS `z-[9999]`, estrutura interna de arquivos.
  - Essas guardas servem como alarme antecipado contra alterações acidentais em modificações rotineiras, mas **NÃO devem ser tratadas como requisitos permanentes de produto**.

### 1.2 Regra para Refatorações Futuras
Uma refatoração futura pode **alterar, reorganizar ou substituir livremente uma Guarda Estrutural** (ex: modularizar componentes, renomear funções internas, extrair novos modais, modernizar estratégias de renderização), desde que:
1. O comportamento funcional protegido permaneça intacto;
2. As invariantes comportamentais continuem rigorosamente atendidas;
3. Exista mecanismo equivalente ou superior de proteção/verificação;
4. A suíte de testes seja legitimamente atualizada para refletir a nova estrutura técnica, sem encobrir regressões funcionais.

**Quando a refatoração preserva integralmente o comportamento aprovado, NÃO é necessário solicitar autorização de conflito**, pois o produto não sofreu regressão.  
O relatório formal de conflito é **obrigatório exclusivamente** se o **comportamento funcional aprovado** for alterado, degradado, substituído ou removido.

### 1.3 Rastreabilidade Objetiva de Testes
- Cada PB exige rastreabilidade:
  `PB-XXX → Comportamento aprovado → Invariantes Comportamentais + Guardas Estruturais → Testes correspondentes → Resultado`.
- Testes baseados em asserções estáticas de strings ou código-fonte são classificados e documentados como **GUARDAS ESTRUTURAIS**, reconhecendo com honestidade técnica que testes de código estático verificam a estrutura atual, enquanto a validação final da experiência (ex: renderização gráfica no navegador, rolagem por toque) é complementada em tempo de execução real.

---

## 2. Gate Obrigatório de Não-Regressão e Fluxo Pós-Aprovação Completo
Todas as alterações futuras e o ciclo de homologação de novas PBs devem seguir rigorosamente o fluxo:

```text
1. ALTERAÇÃO SOLICITADA
       ↓
2. CONSULTA AO PROTECTED_BEHAVIORS.MD (Mapeamento de impacto em PBs existentes)
       ↓
3. IMPLEMENTAÇÃO CIRÚRGICA (Menor impacto, preservação das invariantes)
       ↓
4. VALIDAÇÃO DO NOVO REQUISITO
       ↓
5. VERIFICAÇÃO DOS COMPORTAMENTOS PROTEGIDOS & SUÍTE DE REGRESSÃO
       ↓
6. APROVAÇÃO TÉCNICA (lint, type-check, testes executáveis)
       ↓
7. ENTREGA PARA TESTE DO USUÁRIO
       ↓
8. CONFIRMAÇÃO DO USUÁRIO ("TESTADO E APROVADO")
       ↓
9. REGISTRO / ATUALIZAÇÃO FORMAL DA PB-XXX (Metadados e invariantes)
       ↓
10. CRIAÇÃO OU ATUALIZAÇÃO DAS PROTEÇÕES TÉCNICAS ESPECÍFICAS
       ↓
11. EXECUÇÃO DOS TESTES ESPECÍFICOS DA NOVA PB
       ↓
12. EXECUÇÃO DO GATE DE REGRESSÃO RELEVANTE (`npm run test:regression`)
       ↓
13. LINT / VALIDAÇÃO ESTÁTICA (`npm run lint`)
       ↓
14. CONFIRMAÇÃO DE QUE AS PROTEÇÕES ANTERIORES CONTINUAM VÁLIDAS
       ↓
15. DECLARAÇÃO FORMAL DO STATUS DA PB:
     • PROTEGIDA (se todas as verificações passaram)
     • PROTEÇÃO PARCIAL (se houver dependência manual ou cobertura incompleta)
     • NÃO PROTEGIDA (se falhar verificação ou sem mecanismo confiável)
```

Se qualquer verificação técnica falhar, a PB **NÃO** receberá status de proteção completa.

---

## 3. Status de Proteção e Estrutura Padrão de PB

### 3.1 Definições Formais de Status
Nunca declare status `PROTEGIDA` apenas porque a PB foi documentada:

* **PROTEGIDA:** Invariantes relevantes possuem proteção técnica adequada (testes executáveis específicos) e todas as verificações (testes específicos, gate geral, lint, não-regressão de PBs anteriores) foram concluídas com sucesso.
* **PROTEÇÃO PARCIAL:** Parte importante do comportamento ainda depende de validação manual, ou a cobertura técnica é incompleta para a totalidade das invariantes.
* **NÃO PROTEGIDA:** Não existe mecanismo técnico confiável suficiente para declarar proteção, ou uma verificação automatizada falhou.

### 3.2 Estrutura Padrão de Registro de PB
Cada entrada homologada deve seguir obrigatoriamente a estrutura:

```markdown
### [PB-XXX] Título do Comportamento
- **ID:** PB-XXX (Sequencial, único, nunca reutilizado)
- **Status da Proteção:** PROTEGIDA | PROTEÇÃO PARCIAL | NÃO PROTEGIDA
- **Data de Aprovação:** AAAA-MM-DD
- **Problema Originalmente Corrigido:** Descrição clara da falha original.
- **Comportamento Aprovado:** Descrição do funcionamento correto esperado.
- **Invariantes Obrigatórias:** Condições e regras lógicas que nunca podem ser violadas.
- **Rastreabilidade Técnica:**
  - `PB-XXX` → Comportamento → Invariantes → Teste específico → Resultado
- **Arquivos Relacionados:** Caminhos absolutos dos arquivos envolvidos.
- **Funções / Componentes Relacionados:** Funções, hooks e componentes específicos.
- **Endpoints & Banco de Dados:** Rotas de API, queries, triggers e tabelas relacionadas.
- **Serviços Externos & Dependências:** Bibliotecas e integrações envolvidas.
- **Testes Responsáveis:** Caminho do(s) teste(s) executável(is) específico(s) da PB.
- **Pontos Críticos de Regressão:** Áreas com risco de quebra colateral.
- **Observações de Manutenção:** Recomendações para desenvolvedores futuros.
```

---

## 4. Registro de Comportamentos Protegidos Homologados

### [PB-001] Visualização Imediata de Documentos no Lançamento Manual com Ação Única no Chip
- **ID:** PB-001
- **Status da Proteção:** PROTEGIDA
- **Data de Aprovação:** 2026-10-29
- **Problema Originalmente Corrigido:** 
  1. Ao carregar um comprovante, nota ou fatura na tela de Lançamento Manual (`isManualLaunch`), o clique no botão do olho (`VER`) não abria o documento, pois o componente `<AttachmentPreviewModal />` estava montado apenas no segundo bloco de retorno (`return`) de conciliação em lote, não sendo renderizado na árvore do DOM do Lançamento Manual.
  2. Havia um botão avulso redundante (`Visualizar Documento`) posicionado fora do chip, poluindo a interface.
- **Comportamento Aprovado:**
  1. No formulário de Lançamento Manual, quando um documento (foto ou PDF) é carregado, o usuário visualiza o chip com o nome e o ícone de olho (`VER`).
  2. Ao clicar em `VER`, o modal de pré-visualização em alta resolução (`AttachmentPreviewModal`) abre imediatamente sobreposto com zoom, renderização de imagem/PDF e download.
  3. A ação de visualização reside exclusivamente dentro do chip do documento carregado, sem botões avulsos duplicados ao lado.
  4. O fechamento do modal restaura o foco no formulário de lançamento preservando todos os campos intactos.

#### A) Invariantes Comportamentais (Regras Funcionais Protegidas - Não podem sofrer regressão)
- **IC-1 (Acesso Direto no Chip):** O usuário deve conseguir visualizar qualquer documento anexado acionando o controle de visualização integrado diretamente no chip correspondente ao documento.
- **IC-2 (Sem Controles Redundantes):** A área de upload de documentos do Lançamento Manual deve manter controle único por documento, sem botões avulsos redundantes de visualização fora dos chips.
- **IC-3 (Preservação de Dados Preenchidos):** Abrir, navegar no documento, alterar zoom ou fechar a visualização não pode resetar, limpar ou modificar os dados já digitados no formulário contábil (`selectedDate`, `manualAmount`, `manualDescription`, `selectedChurchId`, `selectedBankId`, `selectedType`, `attachments`).
- **IC-4 (Sobreposição em Primeiro Plano):** O modal de pré-visualização deve ser renderizado acima do formulário de lançamento manual, permitindo visualização desimpedida e fechamento acessível.

#### B) Guardas Estruturais / Implementação Atual (Técnicas Atuais de Proteção - Substituíveis em Refatoração)
- **GE-1:** Presença do componente `<AttachmentPreviewModal />` montado no retorno condicional de `isManualLaunch` em `ManualIdModal.tsx` conectado ao estado `previewAttachment`.
- **GE-2:** Chamada a `setPreviewAttachment(att)` no evento `onClick` do botão que contém o ícone `Eye` no chip de anexo.
- **GE-3:** Ausência estática do elemento `<button>...Visualizar Documento</button>` fora dos chips no JSX de `ManualIdModal.tsx`.
- **GE-4:** Presença da classe de utilitário Tailwind `z-[9999]` no container de sobreposição de `AttachmentPreviewModal.tsx`.

#### C) Diretrizes para Refatorações Futuras
- **Permitido sem autorização de conflito:** Uma refatoração futura pode reorganizar os componentes (ex: mover o modal para um Context/Portal global compartilhado, unificar os retornos JSX de `ManualIdModal`, trocar o nome da prop/estado `previewAttachment`, ou adotar novo design system), desde que as invariantes comportamentais IC-1, IC-2, IC-3 e IC-4 continuem integralmente satisfeitas e os testes correspondentes sejam legitimamente adaptados.
- **Obrigatoriedade de autorização:** Apenas se a refatoração implicar alteração na experiência aprovada pelo usuário (ex: remoção do visualizador, retorno de botões duplicados ou perda de dados do formulário).

#### D) Rastreabilidade Técnica & Escopo Real de Verificação
- **Rastreabilidade:** `PB-001` → Visualização no Lançamento Manual → IC-1 a IC-4 + GE-1 a GE-4 → `tests/regression/pb001_manual_launch_preview.test.ts` → Aprovado.
- **Escopo Automatizado (Node.js Test Runner):**
  - Validação de não-mutação de dados e isolamento de estado do anexo (testa a lógica de IC-3).
  - Verificação de presença e fiação estrutural dos componentes e manipuladores de evento no código (GE-1, GE-2, GE-3, GE-4).
- **Escopo de Tempo de Execução Real (Navegador):**
  - Renderização do PDF via worker do PDF.js, decodificação de imagem JPEG/PNG, cálculo de viewport e layout real de z-index no navegador dependem da execução no cliente e foram homologados diretamente pelo usuário em teste funcional.
- **Arquivos Relacionados:**
  - `/components/modals/ManualIdModal.tsx`
  - `/components/financial/AttachmentPreviewModal.tsx`
  - `/types/domain.ts`
- **Funções / Componentes Relacionados:**
  - `ManualIdModal` (bloco `if (isManualLaunch)`)
  - `AttachmentPreviewModal`
  - Estado `previewAttachment` e setter `setPreviewAttachment`
- **Endpoints & Banco de Dados:**
  - Componente client-side com persistência vinculada a `saveAttachmentsForTransaction` e `consolidated_transactions`.
- **Serviços Externos & Dependências:**
  - `lucide-react` (ícone `Eye`, `CheckCircle2`, `X`), PDF.js (worker de renderização)
- **Testes Responsáveis:**
  - `tests/regression/pb001_manual_launch_preview.test.ts`
  - `tests/regression/harness.test.ts`
- **Pontos Críticos de Regressão:**
  - Bifurcações no retorno de `ManualIdModal.tsx` que omitam o componente de pré-visualização.
  - Re-adição acidental de botões duplicados fora dos chips.
- **Observações de Manutenção:**
  - Qualquer futuro refatoramento de modais deve manter o modal de pré-visualização acessível e sobreposto a ambos os fluxos (lançamento avulso e conciliação em lote).

---

### [PB-002] Isolamento, Não-Vazamento e Não-Persistência de Lançamentos Manuais Cancelados (Anti-Ghost Leak)
- **ID:** PB-002
- **Status da Proteção:** PROTEGIDA
- **Data de Aprovação:** 2026-10-29
- **Problema Originalmente Corrigido:**
  1. Ao abrir o formulário de Lançamento Manual (via Sidebar ou botão em Relatórios), o sistema instanciaba preventivamente um rascunho de tela com ID temporário `ghost-manual-*` e o inseria imediatamente no estado de transações conciliadas (`matchResults`).
  2. Quando o usuário desistia, fechava no "X" ou clicava em "Cancelar" sem salvar, o rascunho fantasma permanecia gravado no estado em memória da sessão local do usuário, poluindo a visualização de relatórios com lançamentos vazios/incompletos e induzindo a falso salvamento local.
  3. Durante a reconciliação e hidratação de sessão (`useCloudSync`), transações com IDs temporários corriam o risco de ressuscitar caso fossem retidas no cache do navegador.
- **Comportamento Aprovado:**
  1. A abertura do formulário de Lançamento Manual não introduz nenhum lançamento fantasma (draft/ghost) na listagem contábil ou nos relatórios visíveis do usuário.
  2. Rascunhos de preenchimento são confinados estritamente à tela interna do modal (`bulkIdentificationTxs`).
  3. Ao fechar, cancelar ou navegar para fora do formulário sem clicar em "Salvar Lançamento", qualquer registro com prefixo `ghost-manual-` é purgado do estado, não deixando resíduos nem salvamentos parciais no navegador.
  4. O motor de sincronização com o banco de dados na nuvem (`useCloudSync`) descarta explicitamente identificadores temporários `ghost-manual-`, impedindo sua retenção ou propagação.
  5. Um lançamento manual somente ingressa na listagem de transações e relatórios quando o usuário confirma formalmente o salvamento e a inserção na nuvem (`consolidated_transactions`) é realizada com sucesso com UUID definitivo.

#### A) Invariantes Comportamentais (Regras Funcionais Protegidas - Não podem sofrer regressão)
- **IC-1 (Não-Poluição na Abertura):** Abrir o formulário de lançamento manual não deve inserir ou expor registros temporários ou rascunhos na listagem de transações ou relatórios visíveis do usuário.
- **IC-2 (Cancelamento e Fechamento Sem Efeitos Colaterais):** Fechar ou cancelar o formulário sem salvar deve purgar qualquer rascunho temporário, garantindo que o cancelamento não deixe vestígios no estado em memória ou na interface.
- **IC-3 (Não-Ressurreição no CloudSync):** O motor de sincronização atômica em tempo real (`useCloudSync`) e de hidratação de sessão nunca deve ressuscitar ou reter itens com ID temporário `ghost-manual-*`.
- **IC-4 (Persistência Exclusiva sob Confirmação):** Um lançamento manual só adquire status de transação oficial quando o usuário confirma o salvamento e o registro é persistido na nuvem com UUID definitivo.

#### B) Guardas Estruturais / Implementação Atual (Técnicas Atuais de Proteção - Substituíveis em Refatoração)
- **GE-1:** `Sidebar.tsx` e `ReportsView.tsx` mantêm a chamada a `setMatchResults` removida da função `handleManualLaunch`, populando apenas `setBulkIdentificationTxs`.
- **GE-2:** `ManualIdModal.tsx` (`handleClose`) e `useTransactionMatcher.ts` (`closeManualIdentify`) aplicam o filtro defensivo `.filter((r) => !r.transaction?.id?.startsWith('ghost-manual-'))`.
- **GE-3:** `useCloudSync.ts` filtra itens `isGhost = id.startsWith('ghost-manual-')` na reconstrução de sessão e no loop de `reportsMap`.
- **GE-4:** Testes automatizados executáveis em `tests/regression/pb002_manual_launch_cancellation.test.ts`.

#### C) Diretrizes para Refatorações Futuras
- **Permitido sem autorização de conflito:** Uma refatoração futura pode reorganizar os stores de formulário, migrar o gerenciamento de rascunhos para React Hook Form, Zustand ou outro gerenciador de estado, desde que as invariantes comportamentais IC-1, IC-2, IC-3 e IC-4 continuem integralmente satisfeitas e os testes correspondentes sejam legitimamente adaptados.
- **Obrigatoriedade de autorização:** Apenas se a refatoração implicar retorno de transações fantasmas na listagem, retenção de rascunhos cancelados nos relatórios ou quebra na persistência confirmada.

#### D) Rastreabilidade Técnica & Escopo Real de Verificação
- **Rastreabilidade:** `PB-002` → Isolamento e Anti-Ghost Leak no Lançamento Manual → IC-1 a IC-4 + GE-1 a GE-4 → `tests/regression/pb002_manual_launch_cancellation.test.ts` → Aprovado.
- **Escopo Automatizado (Node.js Test Runner):**
  - Validação da lógica funcional de purga e não-mutação de estado (testa a lógica de IC-1, IC-2 e IC-3).
  - Verificação de presença e fiação estrutural dos filtros defensivos em `Sidebar.tsx`, `ReportsView.tsx`, `ManualIdModal.tsx`, `useTransactionMatcher.ts` e `useCloudSync.ts` (GE-1, GE-2, GE-3, GE-4).
- **Escopo de Tempo de Execução Real (Navegador):**
  - O fluxo completo de abertura do modal pelo usuário, preenchimento, desistência por clique fora ou botão Cancelar e confirmação de tela limpa nos relatórios foi homologado diretamente pelo usuário em teste funcional ("TESTADO E APROVADO").
- **Arquivos Relacionados:**
  - `/components/layout/Sidebar.tsx`
  - `/views/ReportsView.tsx`
  - `/components/modals/ManualIdModal.tsx`
  - `/hooks/reconciliation/useTransactionMatcher.ts`
  - `/hooks/reconciliation/useCloudSync.ts`
- **Funções / Componentes Relacionados:**
  - `handleManualLaunch` (Sidebar e ReportsView)
  - `handleClose` (ManualIdModal)
  - `closeManualIdentify` (useTransactionMatcher)
  - Sincronização e hidratação (useCloudSync)
- **Endpoints & Banco de Dados:**
  - Inserção atômica via `consolidated_transactions` (apenas após submissão válida confirmada).
- **Serviços Externos & Dependências:**
  - `AppContext`, `MatchResult`, `useCloudSync`.
- **Testes Responsáveis:**
  - `tests/regression/pb002_manual_launch_cancellation.test.ts`
  - `tests/regression/harness.test.ts`
- **Pontos Críticos de Regressão:**
  - Reintrodução de injeção prematura de rascunho em `setMatchResults` ao abrir modais manuais.
  - Omissão de sanitização no fechamento/cancelamento de formulários.
- **Observações de Manutenção:**
  - Manter sempre clara a separação entre o estado do formulário ativo (`bulkIdentificationTxs`) e o repositório oficial de lançamentos (`matchResults`).

---

### [PB-003] Validação Rigorosa de Legibilidade Contábil e Rejeição de Documentos Ilegíveis no Upload
- **ID:** PB-003
- **Status da Proteção:** PROTEGIDA
- **Data de Aprovação:** 2026-10-29
- **Problema Originalmente Corrigido:**
  1. Fotos borradas, fotos escuras, capturas diretas de câmera sem foco ou documentos sem conteúdo legível estavam sendo aceitos pelo sistema.
  2. Como nenhum dado contábil era extraído, nenhum campo do formulário era preenchido, mas o arquivo ilegível era anexado ao lançamento sem possuir qualquer validade contábil ou fiscal.
  3. No módulo OCR (`imageOcrReader.ts`), uma injeção sintética de texto (`ARQUIVO: ${fileName}\n`) fazia com que qualquer imagem (mesmo preta ou sem foco) aparentasse conter texto, burlando a contagem de caracteres.
  4. No parser contábil (`expenseDocumentParser.ts`), a heurística de validação de legibilidade utilizava apenas contagem bruta de caracteres ($\ge 35$), aceitando ruído de OCR; ademais, o extrator de favorecido continha um fallback que selecionava linhas aleatórias de ruído como favorecido/emitente, gerando falsos positivos.
- **Comportamento Aprovado:**
  1. Ao carregar um arquivo (foto, captura de câmera ou PDF) no formulário de Lançamento Manual (`ManualIdModal`) ou na inclusão de anexos (`ExpenseDocumentUploader`), o sistema realiza a leitura e validação rigorosa da legibilidade documental.
  2. Se o documento estiver ilegível (sem valor monetário, sem dados de emitente/favorecido estruturados, sem CNPJ/CPF, sem código de barras/linha digitável/chave PIX, sem data válida e sem identificação de tipo documental), o upload é expressamente rejeitado.
  3. O sistema emite notificação clara orientando o usuário (`toast.warning`: "Documento ilegível: Não foi possível identificar dados contábeis válidos no documento enviado. Por favor, envie uma foto ou PDF nítido e legível."), limpa o seletor de arquivos (`e.target.value = ''`) e não anexa o documento.
  4. Documentos nítidos e legíveis (cupons fiscais, DANFEs, recibos válidos, boletos e faturas) continuam sendo processados, extraídos e anexados normalmente.

#### A) Invariantes Comportamentais (Regras Funcionais Protegidas - Não podem sofrer regressão)
- **IC-1 (Rejeição Estrita de Ilegíveis):** Documentos sem legibilidade ou sem dados contábeis válidos DEVEM ser rejeitados no upload, impedindo a criação de anexos sem valor fiscal ou contábil.
- **IC-2 (Notificação Orientativa e Limpeza do Input):** Ao rejeitar um documento ilegível, o sistema deve alertar o usuário por aviso em tela e resetar o campo de seleção de arquivo para permitir novo envio imediato.
- **IC-3 (Aceitação de Documentos Nítidos e Legítimos):** A validação não deve rejeitar documentos legítimos que apresentem ao menos uma informação contábil estruturada (valor, favorecido/emitente válido, CNPJ/CPF, código de barras/PIX, data contábil ou tipo de documento reconhecido).
- **IC-4 (Consistência entre Módulos de Entrada):** A rejeição de ilegibilidade é aplicada de maneira idêntica e consistente tanto no Lançamento Manual quanto no componente de upload de anexos de despesa.

#### B) Guardas Estruturais / Implementação Atual (Técnicas Atuais de Proteção - Substituíveis em Refatoração)
- **GE-1:** Chamada a `isDocumentTextLegible(rawText, extractedData)` em `ManualIdModal.tsx` e `ExpenseDocumentUploader.tsx`.
- **GE-2:** Disparo de `toast.warning('Documento ilegível: Não foi possível identificar dados contábeis...')` antes de criar o anexo.
- **GE-3:** Reset de `e.target.value = ''` nos manipuladores de upload de arquivo para liberar nova seleção.
- **GE-4:** Ausência de injeção sintética de texto (`ARQUIVO: ${fileName}\n`) em `imageOcrReader.ts` e ausência de fallback indiscriminado de favorecido em `expenseDocumentParser.ts`.

#### C) Diretrizes para Refatorações Futuras
- **Permitido sem autorização de conflito:** Refatorações que aprimorem a qualidade do OCR, introduzam pré-processamento de contraste de imagem (binarização/thresholding), ou extraiam novos campos contábeis, desde que mantenham a rejeição de imagens comprovadamente ilegíveis e a notificação correspondente.
- **Obrigatoriedade de autorização:** Apenas se a refatoração implicar alteração na regra funcional aprovada (ex: aceitar novamente documentos ilegíveis ou omitir a notificação orientativa).

#### D) Rastreabilidade Técnica & Escopo Real de Verificação
- **Rastreabilidade:** `PB-003` → Validação de Legibilidade e Rejeição de Documentos Ilegíveis → IC-1 a IC-4 + GE-1 a GE-4 → `tests/regression/pb003_document_legibility_rejection.test.ts` e `tests/regression/manual_launch_ocr.test.ts` → Aprovado.
- **Escopo Automatizado (Node.js Test Runner):**
  - Testes unitários com strings vazias, ruídos de OCR, simulação de câmera desfocada, nomes sintéticos e comprovantes legítimos (`pb003_document_legibility_rejection.test.ts`).
  - Verificação estrutural das guardas em `ManualIdModal.tsx`, `ExpenseDocumentUploader.tsx` e `imageOcrReader.ts`.
- **Escopo de Tempo de Execução Real (Navegador & Dispositivo Móvel):**
  - Captura direta via câmera de celular e upload de imagem inelegível foram homologados diretamente pelo usuário em teste funcional ("TESTADO E APROVADO").
- **Arquivos Relacionados:**
  - `/utils/expenseDocumentParser.ts`
  - `/utils/imageOcrReader.ts`
  - `/components/modals/ManualIdModal.tsx`
  - `/components/financial/ExpenseDocumentUploader.tsx`
- **Funções / Componentes Relacionados:**
  - `isDocumentTextLegible`, `analyzeExpenseDocumentText`, `extractRecipientFromText`
  - `processImageAndExtractText`
  - `handleFileChange` em `ManualIdModal` e `ExpenseDocumentUploader`
- **Endpoints & Banco de Dados:**
  - Previne persistência de anexos ilegíveis em `saveAttachmentsForTransaction` e `consolidated_transactions`.
- **Serviços Externos & Dependências:**
  - Tesseract.js, PDF.js, `sonner` (toast)
- **Testes Responsáveis:**
  - `tests/regression/pb003_document_legibility_rejection.test.ts`
  - `tests/regression/manual_launch_ocr.test.ts`
  - `tests/regression/harness.test.ts`
- **Pontos Críticos de Regressão:**
  - Reinserção de fallback que assuma qualquer linha de texto como emitente ou favorecido.
  - Reinserção de injeção sintética de texto de arquivo no pipeline OCR.
  - Omissão da chamada a `isDocumentTextLegible` antes de `setAttachments`.
- **Observações de Manutenção:**
  - Manter a regra de legibilidade associada à presença comprovada de dados contábeis estruturados, nunca apenas contagem ingênua de caracteres brutos.

---

### [PB-004] Alimentação Universal Multi-Banco da Lista Viva e Seleção Estrita de Categorias Contábeis Cadastradas
- **ID:** PB-004
- **Status da Proteção:** PROTEGIDA
- **Data de Aprovação:** 2026-10-30
- **Problema Originalmente Corrigido:**
  1. No painel de upload e alimentação da Lista Viva (`UploadView`), havia um filtro rígido (`key === 'SICOOB' || key === 'SICREDI'`) que impedia a renderização de cartões para quaisquer outros bancos cadastrados (Bradesco, Itaú, Banco do Brasil, Santander, Caixa, Inter, etc.), limitando a alimentação a apenas um banco e bloqueando o carregamento de arquivos de outras contas.
  2. No serviço de conciliação (`LaunchService` e `ConsolidationService`), a verificação de `bank_id` exigia um regex restrito de UUID de 36 caracteres (`/^[0-9a-fA-F-]{36}$/`), descartando o `bank_id` como `null` caso não fosse UUID e agrupando os lançamentos de diferentes bancos sob a chave genérica `virtual`, quebrando a segregação e visualização em relatórios secundários.
  3. Na tela de identificação de transações (`ManualIdModal`), ao abrir uma transação do relatório ou Lista Viva, o campo Descrição/Categoria exibia e preenchia o texto genérico `"ENTRADA"` (ou `"SAÍDA"`), que não é uma categoria contábil cadastrada no sistema. Ademais, `useLiveListSync` injetava `"ENTRADA"` / `"SAÍDA"` nas transações quando `contribution_type` estava vazio no banco.
- **Comportamento Aprovado:**
  1. O painel de upload de extratos da Lista Viva (`UploadView`) exibe e disponibiliza cartões de carregamento para todos os bancos cadastrados no sistema, permitindo alimentar e conciliar arquivos de quantos bancos estiverem ativos.
  2. Cada arquivo carregado preserva seu respectivo `bank_id` no banco de dados e nos estados em memória, mantendo a segregação correta por instituição e refletindo com precisão nos relatórios tanto do usuário principal quanto de usuários secundários autorizados.
  3. No modal de identificação (`ManualIdModal`), o campo Descrição/Categoria exibe e seleciona exclusivamente categorias reais cadastradas no sistema (`contributionTypes` / `contributionKeywords`).
  4. Rótulos genéricos como "ENTRADA" ou "SAÍDA" são expressamente rejeitados no campo de categoria; quando a transação ainda não possui categoria definida, o sistema seleciona automaticamente a categoria contábil cadastrada padrão ("Dízimo" para receitas ou a primeira categoria cadastrada de saída para despesas), permitindo alteração posterior pelo usuário para qualquer outra categoria cadastrada.

#### A) Invariantes Comportamentais (Regras Funcionais Protegidas - Não podem sofrer regressão)
- **IC-1 (Multi-Banco Universal na Lista Viva):** O painel de alimentação da Lista Viva deve exibir e aceitar arquivos de extrato para qualquer banco cadastrado no sistema, sem restringir a um único banco ou marcas específicas.
- **IC-2 (Preservação de `bank_id` e Segregação):** Transações importadas de extratos devem preservar rigorosamente seu identificador de banco (`bank_id`), garantindo agrupamento correto e visibilidade nos relatórios de usuários autorizados.
- **IC-3 (Seleção Estrita de Categorias Cadastradas):** Na tela de identificação (`ManualIdModal`), o campo Descrição/Categoria deve exibir e selecionar exclusivamente categorias contábeis cadastradas e ativas no sistema.
- **IC-4 (Higienização de Rótulos Genéricos e Padrão Cadastrado):** O sistema nunca deve exibir nem gravar strings genéricas como "ENTRADA" ou "SAÍDA" no campo de categoria contábil; transações sem categoria devem adotar por padrão a categoria cadastrada padrão ("Dízimo" para receitas ou categoria padrão de saída).

#### B) Guardas Estruturais / Implementação Atual (Técnicas Atuais de Proteção - Substituíveis em Refatoração)
- **GE-1:** `UploadView.tsx` renderiza `availableBanks = banks || []` sem filtro restritivo de marca bancária.
- **GE-2:** `LaunchService.ts` preserva `currentBankId = bankId && bankId !== 'virtual' ? bankId : null` sem descartar IDs válidos.
- **GE-3:** `ConsolidationService.ts` preserva `bank_id: t.bank_id && t.bank_id !== 'virtual' ? t.bank_id : null`.
- **GE-4:** `useLiveListSync.ts` sanitiza `contributionType` para `undefined` quando for rótulo genérico (`ENTRADA`/`SAÍDA`).
- **GE-5:** `ManualIdModal.tsx` implementa `isGenericOrInvalidType` e validação contra `contributionTypes`/`contributionKeywords`, definindo `defaultEntradaType` ("Dízimo") ou `defaultSaidaType`.

#### C) Diretrizes para Refatorações Futuras
- **Permitido sem autorização de conflito:** Refatorações na interface de cartões de banco, novos métodos de parsing de extratos bancários, reorganização do seletor de categorias na modal, desde que as invariantes IC-1 a IC-4 permaneçam integralmente satisfeitas.
- **Obrigatoriedade de autorização:** Apenas se a refatoração implicar restrição a bancos específicos, perda de segregação de banco, retorno de categorias genéricas ("ENTRADA"/"SAÍDA") ou quebra no preenchimento padrão de categorias cadastradas.

#### D) Rastreabilidade Técnica & Escopo Real de Verificação
- **Rastreabilidade:** `PB-004` → Multi-Banco na Lista Viva & Categorias Cadastradas → IC-1 a IC-4 + GE-1 a GE-5 → `tests/regression/pb004_multibank_and_category_validation.test.ts` → Aprovado.
- **Escopo Automatizado (Node.js Test Runner):**
  - Validação funcional de sanitização de categorias e seleção padrão ("Dízimo").
  - Verificação de renderização multi-banco e preservação de `bank_id`.
- **Escopo de Tempo de Execução Real (Navegador):**
  - Carregamento de arquivos de múltiplos bancos e visualização no relatório de usuário secundário homologados diretamente pelo usuário em teste funcional ("TESTADO E APROVADO").
- **Arquivos Relacionados:**
  - `/views/UploadView.tsx`
  - `/hooks/useLiveListSync.ts`
  - `/components/modals/ManualIdModal.tsx`
  - `/services/LaunchService.ts`
  - `/services/ConsolidationService.ts`
  - `/services/processingService.ts`
- **Funções / Componentes Relacionados:**
  - `UploadView`
  - `ManualIdModal` (`isGenericOrInvalidType`, `selectedType`, `defaultEntradaType`)
  - `useLiveListSync` (`hydrate`)
  - `LaunchService` (`launchToBank`)
- **Endpoints & Banco de Dados:**
  - `consolidated_transactions` (persistência correta de `bank_id` e `contribution_type`).
- **Testes Responsáveis:**
  - `tests/regression/pb004_multibank_and_category_validation.test.ts`
  - `tests/regression/harness.test.ts`
- **Pontos Críticos de Regressão:**
  - Retorno de filtros por string de banco no upload.
  - Reintrodução de validação estrita de regex UUID em `bank_id` que descarte bancos personalizados.
  - Sobrescrita de `selectedType` com strings genéricas de tipo contábil.
- **Observações de Manutenção:**
  - Manter sempre clara a separação entre a direção da transação (`type: income/expense`) e a categoria contábil (`contributionType`).

---

### [PB-005] Persistência Real e Imediata de Documentos e Não-Sobrescrita Concorrente em Modais de Anexos (Anti-Wipeout)
- **Status:** PROTEGIDA (Homologada após "TESTADO E APROVADO" pelo usuário)
- **Data de Homologação:** 01 de Novembro de 2026
- **Descrição Resumida:**
  Garante que ao carregar um comprovante, boleto, fatura ou nota fiscal na tela de **Anexar Arquivo** (`QuickAttachModal`), na tela de **Identificação** (`ManualIdModal`) ou na tela de **Edição de Lançamento Manual** (`EditManualTransactionModal`), o documento permaneça visível com seus botões de ação e seja persistido de forma imediata e real no banco de dados na nuvem (PostgreSQL / SQLite) e no armazenamento local (`IndexedDB` + cache). Elimina completamente o efeito de "carrega e some" em fração de segundos decorrente de disparos concorrentes de renderização do componente pai, e garante autorização total (`isAuthorizedForTransaction`) no backend para registros da Lista Viva (com congregação pendente ou `'unidentified'`).
- **Invariantes Comportamentais (O Que o Usuário Aprovou):**
  1. **IC-1: Não-Desaparecimento de Documentos no Carregamento:** Ao carregar um arquivo ou tirar uma foto, o chip do documento carregado permanece fixo e utilizável em tela, permitindo visualização, troca de papel/tipo do documento e remoção sem reset visual.
  2. **IC-2: Hidratação Única e Protegida por Transação:** A leitura de anexos existentes do banco de dados para a modalidade de anexo rápido é executada estritamente uma única vez por transação ao abrir o modal. Renderizações externas ou emissão de eventos pela interface pai não reinicializam ou zeram o estado de anexos em edição.
  3. **IC-3: Autorização Completa de Itens da Lista Viva:** Transações bancárias pendentes (onde `church_id` é nulo ou `'unidentified'`) possuem autorização concedida em `isAuthorizedForTransaction` para administradores e usuários secundários autorizados pelo banco ou congregações, permitindo consultas e gravações de anexos sem retorno 403 (FORBIDDEN).
  4. **IC-4: Integridade do Endpoint Sob Demanda:** O endpoint `GET /api/v1/consolidated_transactions/:id/attachments` resgata e valida os metadados contábeis da transação incluindo `id`, `bank_id` e `status` no SELECT.
  5. **IC-5: Espelhamento Completo no SmartPool:** A sincronização do motor local SQLite para o PostgreSQL remoto na nuvem transfere a coluna `attachments` preservando dados existentes.
- **Guardas Estruturais (Implementação Técnica Atual):**
  - **GE-1:** `QuickAttachModal.tsx` gerencia `loadedTxIdRef` e não inclui `transaction?.attachments` no array de dependências do `useEffect`.
  - **GE-2:** `QuickAttachModal.tsx` aciona `saveAttachmentsForTransaction(transaction.id, newAtts)` imediatamente ao detectar alteração de anexos no `onChangeAttachments`.
  - **GE-3:** `ManualIdModal.tsx` sincroniza `bulkIdentificationTxs[0].attachments` e grava em tempo real via `saveAttachmentsForTransaction` tanto no upload quanto na exclusão de anexos.
  - **GE-4:** `contributors-api/server.ts` autoriza transações com `church_id` nulo ou `'unidentified'` com base em `allowedBankIds` e vínculo do proprietário.
  - **GE-5:** `EditManualTransactionModal.tsx` utiliza `initializedRowIdRef` e auto-persiste anexos em tempo real.
- **Escopo de Tempo de Execução Real (Navegador):**
  - Carregamento de arquivos na tela de anexar arquivo da tabela de lançamentos homologado diretamente pelo usuário em teste funcional ("TESTADO E APROVADO").
- **Arquivos Relacionados:**
  - `/components/modals/QuickAttachModal.tsx`
  - `/components/modals/ManualIdModal.tsx`
  - `/components/modals/EditManualTransactionModal.tsx`
  - `/contributors-api/server.ts`
  - `/services/expenseAttachmentService.ts`
- **Funções / Componentes Relacionados:**
  - `QuickAttachModal`
  - `ManualIdModal` (`handleFileSelected`, `handleRemoveAttachment`)
  - `EditManualTransactionModal` (`onChangeAttachments`)
  - `isAuthorizedForTransaction` em `contributors-api/server.ts`
  - `saveAttachmentsForTransaction` em `expenseAttachmentService.ts`
- **Endpoints & Banco de Dados:**
  - `PUT /api/v1/consolidated_transactions/:id`
  - `GET /api/v1/consolidated_transactions/:id/attachments`
- **Testes Responsáveis:**
  - `tests/regression/pb005_attachment_persistence_and_anti_wipeout.test.ts`
  - `tests/regression/harness.test.ts`
- **Pontos Críticos de Regressão:**
  - Reintrodução de `transaction?.attachments` nas dependências do `useEffect` de `QuickAttachModal`.
  - Remoção de `loadedTxIdRef` que permita reinicialização do estado durante renderizações do pai.
  - Bloqueio de autorização em `isAuthorizedForTransaction` para transações da lista viva sem `church_id`.

---

### [PB-006] Persistência Real em Nuvem e Anti-Perda de Cadastros de Formas de Pagamento e Recebimento
- **Status:** `PROTEGIDA`
- **Data de Homologação:** 01 de Novembro de 2026
- **Descrição Resumida:**
  Garante que qualquer forma de pagamento ou recebimento cadastrada pelo usuário na aba de Formas de Receb/Pagto (`PaymentMethodsList`), no hook de referência (`useReferenceData`) ou nos modais de transações, seja persistida de forma real, duradoura e atômica no banco de dados na nuvem (PostgreSQL com redundância SQLite no SmartPool) através da API REST (`/api/v1/payment-methods`), e propagada em tempo real (`payment_methods_updated`). Elimina completamente a volatilidade de gravação restrita ao `localStorage` do navegador e remove a lógica legada destrutiva de expurgo em migração que deletava nomes usuais como CARTÃO, BOLETO, TED ou CHEQUE.
- **Invariantes Comportamentais (O Que o Usuário Aprovou):**
  1. **IC-1: Persistência Duradoura em Nuvem:** Qualquer forma de pagamento/recebimento cadastrada (nome, tipo entrada/saída/ambos, categoria, banco vinculado, ordem e status ativo) é salva no banco de dados central na nuvem e permanece disponível mesmo após logout, limpeza de cache, troca de aparelho ou reinicialização de sessão.
  2. **IC-2: Eliminação do Expurgo Destrutivo em Migração:** O hook de dados de referência não remove e não filtra destrutivamente formas cadastradas correspondentes a termos corriqueiros do usuário (ex: CARTÃO, BOLETO, TED, DINHEIRO, CHEQUE, DEPÓSITO).
  3. **IC-3: Sincronização e Coerência Bidirecional em Tempo Real:** Alterações (criação, edição ou exclusão) de formas de pagamento emitem o evento `payment_methods_updated` via `window` e `BroadcastChannel`, atualizando automaticamente todos os selects e modais do sistema sem requerer recarregar a página.
  4. **IC-4: Disponibilidade Imediata em Formulários e Modais de Lançamentos:** Os selects de forma de pagamento (`paymentMethodsOptions`) em `ManualIdModal`, `EditManualTransactionModal` e `SplitTransactionModal` recebem a lista completa e atualizada sincronizada com a nuvem, mantendo `DINHEIRO` e `PIX` como opções base garantidas.
  5. **IC-5: Operações CRUD Completas no Backend:** O backend expõe `GET`, `POST`, `PUT`, `DELETE` em `/api/v1/payment-methods` suportando deleção por UUID ou por nome, com validação de locatário (`user_id`).
- **Guardas Estruturais (Implementação Técnica Atual):**
  - **GE-1:** `contributors-api/server.ts` possui a tabela `payment_methods` criada nos esquemas SQLite e PostgreSQL.
  - **GE-2:** `contributors-api/server.ts` implementa as 4 rotas REST em `/api/v1/payment-methods` com tratamento de concorrência e chave estrangeira de banco vinculada.
  - **GE-3:** `hooks/useReferenceData.ts` consome `/api/v1/payment-methods`, expõe `fetchPaymentMethods` e `paymentMethodItems`, e não possui o bloco de remoção legada de termos.
  - **GE-4:** `components/register/PaymentMethodsList.tsx` aciona `addPaymentMethod`, `updatePaymentMethod` e `removePaymentMethod` conectadas ao backend remoto.
  - **GE-5:** `types/domain.ts` define e exporta `PaymentOperationType` e `PaymentMethodItem`.
- **Escopo de Tempo de Execução Real (Navegador):**
  - Cadastro, edição e persistência duradoura de formas de pagamento e recebimento homologado diretamente pelo usuário em teste funcional ("TESTADO E APROVADO").
- **Arquivos Relacionados:**
  - `/contributors-api/server.ts`
  - `/hooks/useReferenceData.ts`
  - `/components/register/PaymentMethodsList.tsx`
  - `/types/domain.ts`
- **Funções / Componentes Relacionados:**
  - `PaymentMethodsList`
  - `useReferenceData` (`fetchPaymentMethods`, `addPaymentMethod`, `updatePaymentMethod`, `removePaymentMethod`)
  - `payment-methods` endpoints em `contributors-api/server.ts`
- **Endpoints & Banco de Dados:**
  - `GET /api/v1/payment-methods`
  - `POST /api/v1/payment-methods`
  - `PUT /api/v1/payment-methods/:id`
  - `DELETE /api/v1/payment-methods/:id`
- **Testes Responsáveis:**
  - `tests/regression/pb006_payment_methods_cloud_persistence.test.ts`
  - `tests/regression/harness.test.ts`
- **Pontos Críticos de Regressão:**
  - Reintrodução de expurgo de formas de pagamento em `useReferenceData.ts`.
---

### [PB-007] Registro Fidedigno de Transporte de Saldo/Déficit nos Relatórios de Fechamento e Livro Caixa com Preservação de Somas Operacionais
- **Status:** `PROTEGIDA`
- **Data de Homologação:** 01 de Novembro de 2026
- **Descrição Resumida:**
  Garante que ao realizar o Fechamento de Caixa de uma congregação com transferência/transporte de saldo ou cobertura de déficit para outra congregação/conta, o sistema registre automaticamente duas transações financeiras reais vinculadas (uma de débito/saída na congregação de origem para zerar o caixa do período, e uma de crédito/entrada na congregação de destino para iniciar o novo ciclo). Ambas as transações são gravadas com identificadores contábeis claros (`source: 'closing'`), preservando o vínculo bancário (`bank_id`), exibidas com selos distintivos no Livro Caixa e mantendo as somas operacionais de entradas e saídas correntes 100% fiéis e despoluídas de movimentações de transporte.
- **Invariantes Comportamentais (O Que o Usuário Aprovou):**
  1. **IC-1: Geração Bipolar de Transporte:** Ao homologar o fechamento com transporte, o sistema gera e grava a transação de saída/débito na igreja/conta de origem (zerando seu saldo contábil) e a transação de entrada/crédito na igreja/conta de destino (abrindo o novo ciclo).
  2. **IC-2: Fidelidade Absoluta das Somas Operacionais:** As somas de Entradas e Saídas do Livro Caixa (`financialTotals`) excluem rigorosamente as transações de fechamento/transporte (`isClosingTransfer`), impedindo que o saldo transportado infle as receitas ou despesas correntes do mês.
  3. **IC-3: Exibição Visual Distintiva e Sem Truncamento:** Os registros de fechamento exibem selos visuais claros (`Transporte p/ Outro Caixa (Débito)` e `Transporte Recebido (Crédito)`), e sua descrição completa não é truncada por higienizadores textuais de extrato ao conter períodos ou datas de competência (ex: `10/2026`).
  4. **IC-4: Resolução Garantida de Conta Bancária:** A transação de destino resolve e grava `bank_id` válido, impedindo que o lançamento desapareça ao filtrar o Livro Caixa por banco.
  5. **IC-5: Linha Dedicada de Conciliação no Rodapé:** Quando houver movimentação de transporte no período filtrado, o rodapé da tabela do Livro Caixa exibe uma linha dedicada detalhando o valor transportado e o Saldo Final Resultante do Caixa.
- **Guardas Estruturais (Implementação Técnica Atual):**
  - **GE-1:** `components/modals/ChurchClosingModal.tsx` gera `originMatch` e `destMatch` com `source: 'closing'`, `isConfirmed: true`, resolução de `destBankId` e descrições estruturadas.
  - **GE-2:** `contexts/AppContext.tsx` repassa `source` na transformação de `matchResults` para `reportData`.
  - **GE-3:** `services/utils/parsingUtils.ts` preserva descrições iniciadas por `[FECHAMENTO]`, `[RECEBIMENTO]`, `[APORTE/FECHAMENTO]` e `[REPASSE/FECHAMENTO]`.
  - **GE-4:** `views/LivroCaixaView.tsx` identifica `isClosingTx` para estilização e `isClosingTransfer` para isolamento de totais operacionais e renderização de linha de conciliação.
  - **GE-5:** `types/domain.ts` define `source?: string` na interface `MatchResult`.
- **Escopo de Tempo de Execução Real (Navegador):**
  - Fechamento com transporte e reflexo detalhado nos relatórios do Livro Caixa homologado diretamente pelo usuário em teste funcional ("ok, tetado e aprovado").
- **Arquivos Relacionados:**
  - `/components/modals/ChurchClosingModal.tsx`
  - `/views/LivroCaixaView.tsx`
  - `/contexts/AppContext.tsx`
  - `/services/utils/parsingUtils.ts`
  - `/types/domain.ts`
  - `/contributors-api/server.ts`
- **Funções / Componentes Relacionados:**
  - `ChurchClosingModal` (geração e gravação de `transferTransactions`)
  - `LivroCaixaView` (`filteredReportData`, `financialTotals`, `summaryBreakdown`, renderização de tabela e rodapé)
  - `cleanDisplayDescription` em `parsingUtils.ts`
- **Endpoints & Banco de Dados:**
  - `POST /api/v1/church-closings`
  - `consolidated_transactions` (registros com `source = 'closing'`)
- **Testes Responsáveis:**
  - `tests/regression/pb007_church_closing_balance_transport.test.ts`
  - `tests/regression/harness.test.ts`
- **Pontos Críticos de Regressão:**
  - Adição acidental de transações `isClosingTransfer` nas somas de `financialTotals.income` ou `financialTotals.expenses`.
  - Remoção de `source: 'closing'` no mapeamento de `reportData` em `AppContext.tsx`.
  - Omissão de `destBankId` deixando transações de destino órfãs de banco.

---

## 5. Candidatos a Proteção (Aguardando Aprovação Formal)

Os itens abaixo representam funcionalidades críticas e estabilizadas identificadas no sistema que se beneficiarão de registro como PB assim que forem formalmente homologadas pelo usuário:

### [CANDIDATO-01] Lançamento Manual com Persistência Imediata no Relatório Ativo
- **Contexto:** Lançamento avulso de receitas ou despesas com inserção atômica na VPS (`consolidated_transactions`) e atualização imediata do cache do relatório ativo sem recarregar ou perder itens existentes.
- **Invariantes Principais:**
  1. `onAfterAction` deve ser invocado de forma síncrona com a lista atualizada de transações.
  2. Substituição do ID temporário (`ghost-manual-...`) pelo UUID definitivo do banco sem duplicações.
  3. Reconstrução imediata do mapa de resultados no relatório (`needsFullRebuild`) quando um novo ID é detectado.

### [CANDIDATO-02] Leitura Resiliente de Documentos de Despesa (PDF Digital + OCR Óptico)
- **Contexto:** Upload de faturas, boletos, recibos e notas fiscais no modal de Lançamento Manual.
- **Invariantes Principais:**
  1. O `ArrayBuffer` de PDFs deve ser clonado antes da transferência para o worker do PDF.js para prevenir erros de buffer desanexado (`detached ArrayBuffer`).
  2. Falhas parciais de leitura textual (OCR óptico ou PDF escaneado) não devem abortar a criação do anexo nem impedir o preenchimento manual do lançamento.
  3. Preenchimento de dados textuais deve respeitar e não sobrescrever campos já editados manualmente pelo usuário.

### [CANDIDATO-03] Rolagem Universal por Toque (Touch Scrolling & Gestos)
- **Contexto:** Navegação e rolagem suave em dispositivos móveis e telas touch.
- **Invariantes Principais:**
  1. O motor de arrasto por mouse (`useGlobalDragScroll`) nunca deve interceptar ponteiros de toque (`pointerType === 'touch'` ou `'pen'`).
  2. O CSS deve sempre manter `-webkit-overflow-scrolling: touch` e `touch-action: pan-x pan-y pinch-zoom`.

### [CANDIDATO-04] Otimização de Memória & Lazy Loading de Telas
- **Contexto:** Prevenção de crashes por exaustão de memória no navegador móvel.
- **Invariantes Principais:**
  1. Proibido pré-carregamento concorrente de todas as visualizações (`preloadAllViews`).
  2. Carregamento sob demanda com Suspense e fronteiras de erro.

### [CANDIDATO-05] Paginação Padrão em Relatórios e Gestão Financeira
- **Contexto:** Renderização fluida de tabelas e listas extensas.
- **Invariantes Principais:**
  1. As telas de Relatórios, Livro Caixa e Cadastros mantêm paginação padrão (50 itens por página).
  2. Totais agregados e exportações (PDF/Excel) continuam operando sobre a totalidade dos dados filtrados, nunca apenas sobre a página visível.

### [CANDIDATO-06] Persistência em Tempo Real, Anti-Ressurreição & Isolamento por Congregação
- **Contexto:** Isolamento estrito de dados entre usuários proprietários e congregações de usuários secundários.
- **Invariantes Principais:**
  1. Banco de dados central na nuvem é a única fonte da verdade em tempo real.
  2. Proibida a ressurreição de transações apagadas via caches locais residuais.
  3. Filtragem restrita de congregações autorizadas para usuários secundários em backend e frontend.

### [CANDIDATO-07] Sincronização Bidirecional de Cadastros (Sistema Principal vs. Portal)
- **Contexto:** Atualização em tempo real de membros e contribuintes entre o painel e o portal público.
- **Invariantes Principais:**
  1. Persistência de redundância dupla (`SmartPool` com PostgreSQL e SQLite local fallback).
  2. Evento `contributor_updated` sincroniza as duas interfaces sem requerer refresh de página.

---

## 6. Procedimento para Conflitos com Comportamentos Protegidos
Se uma futura solicitação de ajuste entrar em conflito direto ou aparente com uma PB registrada:

1. **PARE** imediatamente a implementação.
2. Apresente formalmente o relatório de conflito no formato:
   ```text
   CONFLITO COM PROTEÇÃO: [PB-XXX]
   COMPORTAMENTO ATUALMENTE PROTEGIDO: [...]
   NOVA SOLICITAÇÃO: [...]
   MOTIVO DO CONFLITO: [...]
   IMPACTO: [...]
   ALTERNATIVAS SEGURAS: [...]
   ```
3. Aguarde autorização explícita do usuário antes de realizar qualquer alteração que modifique ou substitua o comportamento protegido.
