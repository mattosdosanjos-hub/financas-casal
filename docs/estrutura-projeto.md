# Estrutura do projeto — Finanças T&D (Lovable + Supabase)

Árvore de arquivos para orientar os prompts do Lovable. Ajustada em relação ao
briefing original: sem `ConfigContas` (decisão: só 4 cartões + "Dinheiro/Pix",
sem tabela `contas` separada) e com componentes de gráfico (decisão: dashboard
com gráficos entra na v1).

```
src/
  components/
    painel/
      HeroDisponivel.tsx
      CardProjecaoReceita.tsx
      CardGastosFixos.tsx
      CardGastosCartao.tsx
      CardMeta.tsx
      FaturasAbertas.tsx
      Alertas.tsx
      ModalFecharMes.tsx
    lancamentos/
      FormLancamento.tsx
      SeletorTipo.tsx
      SeletorCategoria.tsx
      SeletorPagamento.tsx
    investimentos/
      HeroInvestimentos.tsx
      AporteRapido.tsx
      HistoricoAportes.tsx
      ProgressoMeta.tsx        -- novo: barra de progresso dos R$ 100k
    historico/
      ListaMeses.tsx
      CardMes.tsx
    graficos/
      GraficoCategorias.tsx    -- novo: pizza de gastos por categoria no mês
      GraficoEvolucaoMensal.tsx -- novo: linha de receita/gasto/saldo por mês
    config/
      ConfigMetas.tsx
      ConfigCartoes.tsx
      ConfigFixas.tsx
      ConfigCategorias.tsx     -- inclui orçamento mensal por categoria
      ConfigConvite.tsx        -- novo: gerar/aceitar convite do casal
  hooks/
    useResumoMes.ts
    useLancamentos.ts
    useMesFatura.ts             -- lógica crítica do cálculo do mês fatura
    useInvestimentos.ts
    useCategorias.ts
    useCartoes.ts
  lib/
    supabase.ts
    mesFatura.ts                -- função pura de cálculo do mês fatura
    formatters.ts                -- moeda, datas
  pages/
    Painel.tsx
    Lancamentos.tsx
    Investimentos.tsx
    Historico.tsx
    Config.tsx
  pages/auth/
    Login.tsx
    AceitarConvite.tsx
```

## Notas de implementação

- **`pagamento`** no formulário de lançamento é um seletor fechado com 5
  opções: os 4 cartões (`cartoes.nome`) + `"Dinheiro/Pix"`. Não há tela de
  cadastro de contas de débito.
- **`useMesFatura`** só aplica a lógica de fechamento quando `pagamento` é um
  dos 4 cartões. Para `"Dinheiro/Pix"`, `mes_fatura` é sempre o mês da própria
  `data` do lançamento (sem regra de corte).
- **Gráficos** (`GraficoCategorias`, `GraficoEvolucaoMensal`) consomem os
  mesmos hooks de `useResumoMes`/`useLancamentos` — não criam uma fonte de
  dados paralela.
- **Convite do casal**: inserir um novo `membros` deve passar por uma Edge
  Function (não por policy de INSERT direto do cliente — ver comentário na
  migration de RLS), já que o segundo usuário ainda não tem `user_id` até
  aceitar o convite e se autenticar.
