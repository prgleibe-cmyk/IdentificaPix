
# Checklist de Validação: Arquitetura de Processamento v3

Este documento descreve os testes obrigatórios para validar a integridade dos modelos aprendidos, versionamento e segurança de dados.

## 1. Reconhecimento Estrutural (O DNA)
- [ ] **Match 100%:** Subir um arquivo com layout já treinado. 
    - *Esperado:* O sistema deve exibir o brinde verde "Layout reconhecido (vX)" e habilitar o botão "Processar" sem passar pelo Laboratório.
- [ ] **Divergência Estrutural:** Subir o mesmo banco, mas remover uma coluna no CSV/Excel.
    - *Esperado:* O sistema deve detectar a falha no DNA (Column Count mismatch) e redirecionar para o Laboratório com alerta de "Mudança estrutural".

## 2. Aprendizado Incremental (Linhagem)
- [ ] **Fluxo de Refinamento:** Subir um layout similar (mesmo delimitador e contagem de colunas, mas tipos diferentes).
    - *Esperado:* O Laboratório deve abrir com a mensagem "Layout similar detectado". As configurações do modelo antigo devem vir pré-carregadas.
- [ ] **Versionamento Ativo:** Salvar um refinamento de um modelo existente.
    - *Esperado:* 
        1. No banco de dados, o campo `version` deve ser incrementado.
        2. O `lineage_id` deve permanecer o mesmo.
        3. A versão antiga deve marcar `is_active = false`.
- [ ] **Retrocompatibilidade:** Processar um arquivo antigo que use a v1 após a v2 ser criada.
    - *Esperado:* O sistema deve identificar que o DNA bate com a v1 (pelo headerHash ou topology) e aplicar as regras da v1 corretamente.

## 3. Blindagem de Dados (Security Shield)
- [ ] **Data Integrity Check:** Tentar processar um arquivo onde o modelo espera "Número" mas a coluna contém "Texto".
    - *Esperado:* O `isModelSafeToApply` deve retornar `safe: false` e impedir o processamento automático para evitar erros financeiros.
- [ ] **Regra de Controle:** Validar se linhas contendo "SALDO ANTERIOR" ou "TOTAL" estão sendo descartadas pelo `RowValidator`.
    - *Esperado:* O relatório final não deve conter nenhuma linha de controle bancário, apenas transações reais.

## 4. Contrato das 3 Colunas (Output Standard)
- [ ] **Normalização de Data:** Verificar no Relatório se todas as datas estão no formato da localidade escolhida, independentemente se o arquivo original era `15/07`, `2024-07-15` ou `15-JUL`.
- [ ] **Sinalização de Valor:** Validar se débitos (saídas) aparecem em vermelho e créditos (entradas) em preto/verde.
- [ ] **Sanitização de Nome:** Garantir que "PIX RECEBIDO - JOAO SILVA - ID12345" apareça apenas como "JOAO SILVA" no relatório final.

## 5. Ausência de Regressões
- [ ] **Multi-Igreja:** Carregar 3 listas de contribuintes de igrejas diferentes simultaneamente.
    - *Esperado:* O sistema deve separar os grupos no relatório e não "vazar" contribuintes de uma igreja para a outra.
- [ ] **Troca de Tema/Idioma:** Alternar idioma durante um processamento ativo.
    - *Esperado:* Os dados já processados devem permanecer intactos, mudando apenas os labels da UI.

---
*Data da última revisão: Março de 2025*
*Status da Arquitetura: PROTEGIDA*
