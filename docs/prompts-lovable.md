# Prompts para o Lovable — Finanças T&D

Cole os prompts abaixo no Lovable **um de cada vez, em ordem**, só avançando
para o próximo depois que o anterior estiver funcionando. O schema SQL já
deve ter sido rodado no projeto Supabase (`supabase/migrations/`) antes do
Prompt 1.

Contexto fixo a repetir/colar caso o Lovable perca o fio: projeto é um PWA de
controle financeiro para um casal (Tiago e Duda), mobile-first, gestão 100%
conjunta (sem "meu"/"dela"), estilo visual em `index.html` (fundo off-white,
Space Grotesk + Space Mono, índigo `#5b6ef5` + coral `#ef5757`, bottom nav
com 5 abas, cards com borda sutil).

---

## Prompt 1 — Setup inicial (Supabase, Auth, base do app)

```
Crie a estrutura base de um PWA React + TypeScript + Tailwind chamado
"Finanças T&D", conectado a um projeto Supabase já existente (schema já
criado nas tabelas: casal, membros, cartoes, categorias, despesas_fixas,
lancamentos, aportes_investimento, projecao_receita — todas com RLS via
casal_id).

Requisitos:
1. Cliente Supabase em src/lib/supabase.ts usando variáveis de ambiente do
   Lovable.
2. Autenticação por e-mail/senha (Supabase Auth). Tela de login em
   src/pages/auth/Login.tsx.
3. Fluxo de "primeiro acesso": se o usuário autenticado não tem registro em
   `membros`, mostrar tela para criar um novo casal OU inserir um código de
   convite de um casal existente. Use uma Edge Function para inserir o
   registro em `membros` (não fazer isso direto do cliente).
4. Layout raiz do app: header fixo com nome do casal, área de conteúdo com
   scroll, bottom navigation fixa com 5 abas (🏠 Painel, ✏️ Lançar,
   💎 Invest., 🗓️ Histórico, ⚙️ Config), largura máxima 430px centralizada,
   sem scroll horizontal.
5. Estilo visual: fundo #f4f3f0, cards brancos com borda #ddd9d2 e
   border-radius 14px, cor de destaque índigo #5b6ef5 + coral #ef5757,
   verde #1fa97c para positivo, tipografia Space Grotesk (texto) e Space
   Mono (números/valores monetários).
6. PWA instalável: manifest.json + service worker básico (cache de shell,
   sem necessidade de modo offline completo nesta etapa).
7. src/lib/formatters.ts com função `moeda(valor)` retornando formato
   "R$ 1.234,56".

Não implemente ainda as telas de conteúdo (Painel, Lançar, etc.) — só a
casca do app, auth e navegação entre páginas vazias com título.
```

---

## Prompt 2 — Painel (tela mais importante)

```
Implemente a tela Painel (src/pages/Painel.tsx) do app Finanças T&D.

Hook src/hooks/useResumoMes.ts deve buscar do Supabase, para o casal do
usuário logado e o mês corrente (mes_fatura atual):
- receita real do mês (soma de lancamentos tipo Receita)
- receita projetada do mês (projecao_receita.valor_projetado)
- total de despesas fixas ativas (despesas_fixas)
- total gasto em lancamentos tipo Gasto, agrupado por cartão (pagamento)
- total investido no mês

Regra de cálculo (implementar em src/lib/ ou dentro do hook, testável):
  receita = receita_real > 0 ? receita_real : receita_projetada
  limite_cartao = max(receita - gastos_fixos - meta_guardar, 0)
  disponivel = limite_cartao - total_gasto_cartoes

Componentes:
1. HeroDisponivel — número grande com `disponivel` (verde se >30% do limite
   sobrando, amarelo se positivo mas apertado, vermelho se negativo) +
   barra de progresso "Usado: R$X / Limite: R$Y".
2. CardProjecaoReceita — mostra receita real se > 0 (label "Receita do Mês
   (real)"), senão a projeção (label "Projeção de Receita"). Ao tocar, abre
   um campo para editar e salvar `projecao_receita.valor_projetado` do mês
   corrente (upsert por casal_id + mes).
3. CardGastosFixos — soma automática das despesas_fixas ativas. Toque expande
   lista com descrição, categoria e valor de cada uma.
4. CardGastosCartao — soma de todos os cartões no mês. Toque expande
   detalhamento por cartão.
5. CardMeta — mostra casal.meta_mensal_aporte.
6. FaturasAbertas — um card por cartão (tabela cartoes) mostrando: nome,
   badge "fecha em Xd" (⚠️ se ≤5 dias, 🔴 se ≤2 dias, calculado a partir de
   dia_fechamento), total já lançado no cartão neste mes_fatura, e status
   "Pode gastar mais R$X neste cartão" ou "R$X acima do limite deste
   cartão" (limite por cartão = limite_cartao / número de cartões ativos).
7. Alertas — lista dinâmica: cartão fechando em ≤5 dias, categoria
   ultrapassando orcamento_mensal (se definido), dia 1 do mês (lembrete de
   revisar parcelas), dias 14–16 (lembrete de ver fatura acumulada).
8. ModalFecharMes — botão "🔒 Fechar as contas do mês" abre modal com
   resumo: Projetado, Receita Real, Gastos, Cartão, Investido, Saldo final
   (receita_real - gastos - investido). Se receita_real = 0, avisa que
   ainda não foi lançada. Ao confirmar: grava valor_realizado e fechado_em
   em projecao_receita para o mes corrente.

Todos os dados devem atualizar em tempo real entre os dois celulares — use
Supabase Realtime (subscribe em lancamentos e projecao_receita filtrado por
casal_id) para invalidar/refazer o fetch do useResumoMes quando qualquer um
dos dois lançar algo.
```

---

## Prompt 3 — Lançamentos

```
Implemente a tela Lançar (src/pages/Lancamentos.tsx) e
src/components/lancamentos/FormLancamento.tsx.

Campos:
- Tipo: Gasto / Receita / Investimento (SeletorTipo.tsx, botões com ícone,
  Investimento pré-seleciona categoria "Investimento", Receita pré-seleciona
  categoria "Receita")
- Descrição (texto livre, obrigatório)
- Valor (número > 0, obrigatório)
- Data (date picker, padrão hoje, obrigatório)
- Categoria (SeletorCategoria.tsx — dropdown das categorias do casal)
- Pagamento (SeletorPagamento.tsx — dropdown fechado com só 5 opções: os 4
  cartões cadastrados em `cartoes` + "Dinheiro/Pix")
- Parcelas (número, opcional, padrão 1 = à vista)
- Observação (opcional)

Lógica de Mês Fatura — crie src/lib/mesFatura.ts com uma função pura:
  calcularMesFatura(data: Date, pagamento: string, cartoes: Cartao[]): string
Regra: se pagamento é um dos cartões, olhe o dia_fechamento dele — se o dia
da compra é <= dia_fechamento, mes_fatura é o mês da compra; se é >, é o mês
seguinte. Se pagamento é "Dinheiro/Pix", mes_fatura é sempre o mês da
própria data (sem regra de corte). Formato de saída sempre "Jun/2026" (3
letras maiúsculas + / + ano). Escreva também testes unitários simples para
essa função cobrindo: compra antes do fechamento, no dia do fechamento,
depois do fechamento, e virada de ano (dezembro → janeiro).

Parcelamento: se parcelas > 1, ao salvar crie N registros em `lancamentos`
(um `grupo_parcelamento` UUID comum a todos), cada um com `data` avançando
um mês a partir da data escolhida, `parcela_atual`/`parcela_total`
preenchidos (ex: 1/6, 2/6...), e `mes_fatura` recalculado individualmente
para cada parcela usando a função acima.

O botão de salvar deve ficar desabilitado enquanto faltar campo obrigatório
e mostrar spinner durante o envio. Toast de sucesso/erro + vibração
(navigator.vibrate) como no protótipo antigo. Depois de salvar, limpar o
formulário e manter o foco no campo Descrição para permitir lançar o
próximo gasto rapidamente (meta: menos de 30s por lançamento).
```

---

## Prompt 4 — Investimentos

```
Implemente a tela Investimentos (src/pages/Investimentos.tsx).

Hook src/hooks/useInvestimentos.ts busca: casal.valor_inicial_investimento,
soma de aportes_investimento.valor, e a lista de aportes ordenada do mais
recente para o mais antigo.

Componentes:
1. HeroInvestimentos — total atual = valor_inicial + soma dos aportes.
2. Breakdown — dois cards: "Valor inicial" e "Aportado depois".
3. ProgressoMeta — barra de progresso mostrando total_atual / casal.meta_total
   (ex: R$75.000 / R$100.000 = 75%), com texto do quanto falta e quantos
   meses restam até casal.meta_prazo. A meta mensal de aporte sugerida é
   (meta_total - total_atual) / meses_restantes.
4. AporteRapido — campo de valor + botão "Lançar". Ao confirmar, faz DUAS
   coisas numa transação: cria um registro em aportes_investimento (mes =
   mês corrente, upsert somando ao valor existente do mês se já houver) E
   cria um lancamento tipo "Investimento" correspondente, categoria
   "Investimento", pagamento "Dinheiro/Pix", vinculando
   aportes_investimento.lancamento_id ao lancamento criado.
5. HistoricoAportes — lista de aportes por mês, mais recente primeiro.

Mesmo estilo visual dos outros cards (borda sutil, valores em Space Mono,
verde para valores positivos).
```

---

## Prompt 5 — Histórico

```
Implemente a tela Histórico (src/pages/Historico.tsx).

Para cada mes_fatura já existente em `lancamentos` (distinct, ordenado do
mais recente para o mais antigo), monte um card (CardMes.tsx) com:
Receita do mês, Gasto total do mês, Gasto no cartão do mês, Saldo
(receita - gasto total). Grid 2x2 dentro do card, mesmo estilo do
protótipo (hist-item com cor por tipo: receita verde, gasto coral, cartão
laranja, saldo índigo).

Adicione também os dois gráficos (novos em relação ao protótipo antigo):
- GraficoCategorias.tsx: pizza dos gastos do mês selecionado, agrupados por
  categoria (usa categorias.cor já cadastrada).
- GraficoEvolucaoMensal.tsx: linha com receita, gasto e saldo ao longo dos
  últimos meses.
Ambos ficam no topo da tela de Histórico, acima da lista de cards por mês.
```

---

## Prompt 6 — Configurações

```
Implemente a tela Config (src/pages/Config.tsx):

1. ConfigMetas.tsx — editar casal.meta_mensal_aporte, casal.meta_total,
   casal.meta_prazo.
2. ConfigCartoes.tsx — listar/editar os 4 cartões (nome, banco, titular,
   dia_fechamento, dia_vencimento, ativo). Permitir desativar um cartão
   (não excluir, para preservar histórico de lançamentos).
3. ConfigFixas.tsx — CRUD de despesas_fixas (descrição, valor, categoria,
   pagamento, dia_vencimento, ativa).
4. ConfigCategorias.tsx — CRUD de categorias, incluindo orcamento_mensal
   opcional (usado pelos alertas de estouro no Painel).
5. ConfigConvite.tsx — gerar um link/código de convite para o segundo
   membro do casal se cadastrar (via Edge Function que insere em
   `membros` associando ao mesmo casal_id, sem expor isso como policy de
   INSERT direta no cliente).

Sem tela de "URL do Web App" (não existe mais Google Apps Script) nem
instruções de uso por voz (fora de escopo).
```
