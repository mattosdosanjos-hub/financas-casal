# Funcionalidades validadas — migração para Lovable + Supabase

Lista final aprovada por Tiago em 02/07/2026, a partir do briefing completo
cruzado com o app atual (`index.html`, Google Sheets + Apps Script).

## Decisões específicas tomadas na validação

1. **Formas de pagamento**: só os 4 cartões oficiais (Nubank Tiago, C6
   Tiago, Sicoob Tiago, BRB Maria) + uma opção genérica **"Dinheiro/Pix"**.
   As demais contas do app antigo (Nubank ME, BB Tiago, Itaú ME, Dinheiro,
   Pix separados) saem de escopo — não há tabela `contas` no schema.
2. **Categorias**: sem a categoria especial "Fatura Cartão" — o campo
   `mes_fatura` + `pagamento` do lançamento já identificam gastos de
   cartão, tornando essa categoria redundante.
3. **Lançamento por voz**: fora de escopo (confirma decisão original do
   briefing). **Dashboard com gráficos**: entra na v1 (diferente do
   briefing original, que tinha isso listado como "removido" por engano).

## Mantém do sistema atual

- Painel com "Disponível para Gastar" (hero + barra de limite)
- Projeção de Receita editável, com fallback para receita real quando lançada
- Gastos Fixos calculados automaticamente
- Faturas por cartão sincronizadas em tempo real entre os dois celulares
  (Supabase Realtime — resolve o problema de sincronização do app antigo)
- Lançamento individual com parcelamento automático
- Cálculo automático de Mês Fatura por data + cartão (não editável)
- Geração automática de despesas fixas todo dia 1 (sem duplicar)
- Aba Investimentos com aporte rápido + histórico
- Aba Histórico por mês (receita, gasto, cartão, saldo)
- Botão "Fechar o mês" com comparação Projetado x Real
- Alertas de cartão fechando + lembretes de início/meio de mês

## Entra como melhoria na v1

- Dashboard com gráficos (pizza por categoria, evolução mensal)
- Convite do casal com login próprio da Duda (auth real via Supabase)
- Resumo visual da Meta de investimento (progresso dos R$ 100k)
- Orçamento por categoria com alerta de estouro

## Fica para v2 (não bloqueia a migração)

- Notificações push
- Classificação automática de categoria por palavra-chave
- Importação de extrato CSV
- Modo offline com sync
- Histórico detalhado de lançamentos com filtros

## Fora de escopo definitivo

- Lançamento por voz
- Visualização da planilha dentro do app

---

Ver `supabase/migrations/` para o schema SQL e `docs/prompts-lovable.md`
para os prompts de construção no Lovable, ambos já ajustados a essas
decisões.
