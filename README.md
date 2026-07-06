# Finanças T&D 💰

PWA de controle financeiro do casal — mobile-first, rápido de lançar, com gráficos e assistente de IA. Funciona 100% no celular, **sem backend**: os dados ficam salvos no próprio aparelho (com backup por arquivo JSON).

## Como usar no celular

1. **Publique o app** (uma vez): faça merge deste branch na `main` e, no GitHub, vá em **Settings → Pages → Source: GitHub Actions**. O workflow `Deploy PWA no GitHub Pages` roda os testes e publica automaticamente.
2. Abra a URL do Pages no celular (algo como `https://SEU-USUARIO.github.io/financas-casal/`).
3. **Instale como app**:
   - **Android/Chrome**: menu ⋮ → *Adicionar à tela inicial* (ou o aviso "Instalar app").
   - **iPhone/Safari**: botão de compartilhar → *Adicionar à Tela de Início*.
4. Pronto — abre como app, funciona offline e guarda tudo no aparelho.

> Para testar localmente: `python3 -m http.server 8000` na raiz e abra `http://localhost:8000`.

## O que tem dentro

- **🏠 Painel** — "Disponível para Gastar" (receita − fixos − meta de aporte − gastos no cartão), projeção de receita editável, faturas por cartão com contagem de dias para fechar, alertas (fechamento, orçamento estourado, lembretes de início/meio de mês), insights automáticos e botão **Fechar o mês**.
- **✏️ Lançar** — fluxo pensado para levar menos de 30s: valor primeiro, categoria e pagamento em chips, **mês-fatura calculado automaticamente** pela data + dia de fechamento do cartão, parcelamento em N vezes (cada parcela cai na fatura certa).
- **💎 Invest.** — aporte rápido, total investido, barra de progresso da meta (R$ 100k) e aporte mensal sugerido para bater a meta no prazo.
- **🗓️ Histórico** — gráfico de evolução mensal (receita × gasto × saldo), pizza de gastos por categoria e cards mensais com os lançamentos.
- **⚙️ Config** — metas, cartões (dia de fechamento/vencimento), despesas fixas (geradas automaticamente todo mês, sem duplicar), categorias com orçamento mensal, backup (exportar/importar JSON).
- **✨ Assistente IA** — análise das finanças do mês com Claude. Opcional: cole sua chave da API Anthropic em *Config → Assistente IA* (a chave fica só no aparelho).

## Estrutura

```
index.html            casca do app (5 abas, mobile-first, máx. 430px)
css/app.css           identidade visual (off-white, índigo #5b6ef5, Space Grotesk/Mono)
js/store.js           dados (localStorage, versionado, com seed dos 4 cartões e categorias)
js/calc.js            funções puras: mês-fatura, resumo do mês, alertas, insights
js/charts.js          gráficos SVG (donut + linha), paleta validada p/ daltonismo
js/ia.js              integração com a Claude API (análise financeira)
js/app.js             telas e interações
sw.js / manifest      PWA instalável + offline
tests/calc.test.mjs   testes da lógica de mês-fatura (rodam no CI)
```

## Roadmap (v2)

- Sincronização em tempo real entre os dois celulares via **Supabase** (o schema já está pronto em `supabase/migrations/` e a camada de dados em `js/store.js` foi desenhada para ganhar esse adaptador sem mudar as telas).
- Notificações push, classificação automática por palavra-chave, importação de extrato CSV.

O app antigo (Google Sheets + Apps Script) está preservado em `legado/`.
