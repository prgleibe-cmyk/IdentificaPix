# Plano de Implementação: Seleção de Conta, Intenção de Contribuição com Rateio e Chave Pix

Ajuste cirúrgico no Portal do Contribuinte e no backend para suportar seleção de conta bancária no topo da tela de contribuição, filtragem das descrições de entrada correspondentes, exibição da chave Pix da conta escolhida e persistência da intenção com rateio automático na conciliação/relatórios, respeitando o Protocolo de Blindagem e Preservação de Estrutura.

---

## 1. Diagnóstico do Estado Atual vs. Solicitado

1. **Seleção de Conta no Topo**:
   - *Atual*: A tela de contribuição (`PortalContributionsStep`) carrega todas as entradas públicas da igreja sem um seletor de conta no topo.
   - *Necessário*: No topo da tela de contribuição, se a igreja tiver mais de uma conta cadastrada, exibir o seletor de conta. Se tiver apenas 1 conta, selecioná-la automaticamente.

2. **Filtragem das Descrições de Entrada por Conta**:
   - *Atual*: O endpoint `/api/v1/contribution-types/public` filtra por `church_id` e retorna tipos gerais ou associados a qualquer banco da igreja.
   - *Necessário*: Ao selecionar a conta, exibir as descrições cadastradas vinculadas àquela conta (`bank_id`), além de descrições gerais da congregação.

3. **Geração e Apresentação da Chave Pix da Conta Selecionada**:
   - *Atual*: A etapa de pagamento (`PortalPaymentStep`) tenta associar chaves pelo array de itens selecionados ou usa a primeira chave da igreja.
   - *Necessário*: Ao prosseguir para receber a chave Pix, o contribuinte recebe exatamente a chave Pix vinculada à conta selecionada.

4. **Gravação da Intenção de Contribuição com Rateio (`splits`)**:
   - *Atual*: `POST /api/v1/contribution-requests` grava apenas `church_id`, `contributor_id`, `amount` e uma string de `description`.
   - *Necessário*: Gravar também `bank_id` e o array estruturado de `splits` (ex: `[{ name: "Dízimo", amount: 100 }, { name: "Oferta", amount: 50 }]`).

5. **Auto-identificação e Aplicação de Rateio no Relatório / Conciliação**:
   - *Atual*: A rotina `matchAndLinkContributionRequest` vincula `contribution_request_id` quando o valor, igreja e contribuinte coincidem, mas não preenche automaticamente os `splits` na transação consolidada.
   - *Necessário*: Quando a transação bancária for conciliada e vinculada à intenção, o sistema transfere o rateio (`splits`) automaticamente para `consolidated_transactions.splits`, refletindo no Livro Caixa e Relatórios Financeiros sem intervenção manual.

---

## 2. Etapas de Execução Cirúrgica

### Etapa 1: Backend - Suporte a Contas, Rateio e Chave Pix por Conta
- **Tabela `contribution_requests`**:
  - Adicionar colunas `bank_id` (UUID/TEXT) e `splits` (JSON/TEXT) com migração segura `ADD COLUMN IF NOT EXISTS`.
- **Endpoint `POST /api/v1/contribution-requests`**:
  - Aceitar `bank_id` e `splits` no payload e persistir junto ao registro de intenção.
- **Endpoint `GET /api/v1/contribution-types/public`**:
  - Aceitar parâmetro opcional `bank_id`. Se informado, retornar tipos vinculados àquele `bank_id` e tipos gerais (`bank_id IS NULL`).
- **Rotina `matchAndLinkContributionRequest` (`contributors-api/server.ts`)**:
  - Ao identificar a intenção pendente coincidente (mesmo contribuinte, igreja e valor), recuperar os `splits` gravados na intenção e aplicá-los atomicamente na transação consolidada (`consolidated_transactions.splits`).

### Etapa 2: Portal - Seletor de Conta Bancária na Tela de Contribuição
- **Componente `PortalContributionsStep.tsx`**:
  - Seletor de conta bancária no topo do card (exibindo banco, agência/conta ou apelido).
  - Se houver apenas 1 conta cadastrada, seleção automática sem fricção.
  - Ao alternar a conta, recarregar/filtrar a lista de descrições disponíveis para aquela conta.
  - Campos de entrada: checkbox de seleção + valor (R$) na frente da descrição.
  - Totalizador em tempo real e atalhos de acréscimo (+R$20, +R$50, +R$100, etc.).

### Etapa 3: Wizard Hook (`usePortalWizard.ts`) e Chave Pix Direta
- **Estado do Wizard**:
  - Armazenar `selectedBankId` e lista de contas disponíveis da igreja.
  - Atualizar `createContributionRequest` para enviar `bank_id` e a lista de itens selecionados no campo `splits`.
  - Garantir que a etapa de pagamento (`PortalPaymentStep`) receba a chave Pix da conta selecionada com QR Code e botão de cópia.

### Etapa 4: Validação & Blindagem
- Verificar compilação com `compile_applet` e checagem de tipos com `lint_applet`.
- Testar fluxo completo: login do contribuinte -> seleção da conta -> seleção de categorias com rateio -> geração da chave Pix -> conferência da persistência no banco e na conciliação.
