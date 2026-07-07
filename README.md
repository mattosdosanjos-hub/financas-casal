# Finanças T&D 💰

PWA de controle financeiro do casal — visual premium, rápido de lançar, com gráficos, controle de faturas e assistente de IA. Funciona offline; os dados ficam no aparelho e podem ser sincronizados entre os dois celulares pelo **código do casal**.

## Como usar no celular

1. Abra **https://mattosdosanjos-hub.github.io/financas-casal/** no celular.
2. Instale como app: menu ⋮ → *Adicionar à tela de início* (Android) ou Compartilhar → *Adicionar à Tela de Início* (iPhone).
3. Na primeira abertura, crie a conta do casal — o app gera o **código do casal** (guarde-o!).

> Para testar localmente: `python3 -m http.server 8000` na raiz e abra `http://localhost:8000`.

## O que tem dentro

- **🏠 Painel** — hero com gauge do limite usado, "Disponível para Gastar", faturas por cartão, alertas, insights automáticos e fechamento de mês.
- **💳 Controle de faturas** — cada cartão tem dia de fechamento. Durante o mês você informa quanto está a fatura no banco ("atualizar"); quando o dia de fechamento passa, o app pede o **valor final da fatura fechada**. O painel usa o maior entre a fatura informada e o que foi lançado no app (descontando as fixas do cartão, para não contar duas vezes).
- **✏️ Lançar** — fluxo de menos de 30s, mês-fatura automático, parcelamento.
- **💎 Invest.** — anel de progresso da meta, aporte rápido, sugestão de aporte mensal.
- **🗓️ Histórico** — barras de gasto por mês + donut "para onde foi o dinheiro" + cards mensais.
- **✨ IA** — insights automáticos + análise com Claude (chave opcional em Config).
- **🔑 Código do casal + sincronização** — os dois celulares com o mesmo código veem e lançam nas mesmas contas.

## Ativar a sincronização entre os dois celulares (5 min, grátis)

A sincronização usa o [Supabase](https://supabase.com) (plano gratuito):

1. Crie uma conta em supabase.com → **New project** (qualquer nome/senha).
2. No projeto, abra **SQL Editor** e cole o conteúdo de [`supabase/migrations/20260706150000_casais_sync.sql`](supabase/migrations/20260706150000_casais_sync.sql) → **Run**.
3. Em **Settings → API**, copie a **Project URL** e a chave **anon public**.
4. No app, vá em **⚙️ Config → Sincronização**, cole os dois valores e toque em **Salvar e sincronizar**.
5. No segundo celular: abra o app → **"Já tenho um código do casal"** → digite o código + os mesmos URL/chave.

Pronto: os lançamentos passam a aparecer nos dois aparelhos (a mesclagem é por item, então os dois podem lançar ao mesmo tempo). O código longo e aleatório funciona como a senha do casal — não compartilhe com outras pessoas. Para a versão comercial do app, o plano é evoluir para login com e-mail/senha (Supabase Auth).

## Estrutura

```
index.html            casca do app (5 abas, mobile-first, máx. 430px)
css/app.css           design system v2 (gradientes, cards arredondados, nav flutuante)
js/store.js           dados (localStorage versionado, timestamps p/ sync, tombstones)
js/calc.js            funções puras: mês-fatura, ciclos de fatura, resumo, insights
js/charts.js          gráficos SVG (gauge, anel, barras, donut) — paleta validada p/ daltonismo
js/sync.js            sincronização por código do casal (Supabase REST, merge por item)
js/ia.js              análise financeira com a Claude API
js/app.js             telas, onboarding e interações
sw.js / manifest      PWA instalável + offline
tests/calc.test.mjs   testes de mês-fatura e fatura efetiva (rodam no CI)
```

O app antigo (Google Sheets + Apps Script) está preservado em `legado/`.
