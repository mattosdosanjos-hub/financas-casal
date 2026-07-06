// Assistente IA — análise financeira via Claude API (chave opcional, salva no aparelho).
// A chamada é feita direto do navegador com o cabeçalho de acesso direto.

import { moeda, mesLabel } from './calc.js';

export async function analisarComClaude(apiKey, contexto) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      system: 'Você é um consultor financeiro pessoal de um casal brasileiro. Responda em português do Brasil, de forma direta e prática, em no máximo 6 parágrafos curtos ou bullets. Baseie-se apenas nos dados fornecidos. Dê 2 ou 3 recomendações acionáveis e destaque riscos (estouro de orçamento, ritmo de gasto, meta de investimento). Valores em R$.',
      messages: [{ role: 'user', content: contexto }],
    }),
  });

  if (!resp.ok) {
    const erro = await resp.json().catch(() => ({}));
    const msg = erro?.error?.message || `Erro ${resp.status}`;
    throw new Error(msg.includes('authentication') || resp.status === 401 ? 'Chave de API inválida. Confira em Config.' : msg);
  }

  const data = await resp.json();
  if (data.stop_reason === 'refusal') throw new Error('A análise foi recusada. Tente novamente.');
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

// Monta um resumo textual compacto dos dados para enviar à IA.
export function montarContexto(dados, resumo, historico, categorias) {
  const linhas = [];
  linhas.push(`Mês atual: ${mesLabel(resumo.mesKey)}.`);
  linhas.push(`Receita considerada: ${moeda(resumo.receita)} (real lançada: ${moeda(resumo.receitaReal)}, projetada: ${moeda(resumo.receitaProjetada)}).`);
  linhas.push(`Despesas fixas: ${moeda(resumo.gastosFixos)}. Meta de aporte mensal: ${moeda(resumo.metaAporte)}.`);
  linhas.push(`Limite calculado para cartões: ${moeda(resumo.limiteCartao)}. Gasto em cartões até agora: ${moeda(resumo.totalCartoes)}. Disponível: ${moeda(resumo.disponivel)}.`);
  linhas.push(`Gasto total do mês: ${moeda(resumo.gastoTotal)}. Investido no mês: ${moeda(resumo.investidoMes)}.`);

  const cats = Object.entries(resumo.porCategoria)
    .map(([id, v]) => {
      const c = categorias.find(c => c.id === id);
      const orc = c?.orcamentoMensal ? ` (orçamento ${moeda(c.orcamentoMensal)})` : '';
      return `${c?.nome || 'Outros'}: ${moeda(v)}${orc}`;
    });
  if (cats.length) linhas.push('Gastos por categoria: ' + cats.join('; ') + '.');

  if (historico.length) {
    linhas.push('Histórico (mês: receita / gasto / saldo): ' + historico.map(h =>
      `${mesLabel(h.mesKey)}: ${moeda(h.receita)} / ${moeda(h.gastoTotal)} / ${moeda(h.receita - h.gastoTotal)}`).join('; ') + '.');
  }

  const { config } = dados;
  const totalInvestido = (config.valorInicialInvestimento || 0) + dados.aportes.reduce((s, a) => s + a.valor, 0);
  linhas.push(`Investimentos: total atual ${moeda(totalInvestido)}, meta ${moeda(config.metaTotal)} até ${config.metaPrazo}.`);
  linhas.push(`Hoje é dia ${new Date().getDate()} do mês.`);
  linhas.push('Analise a saúde financeira do casal neste mês e dê recomendações práticas.');
  return linhas.join('\n');
}

// Render simples de markdown (negrito e bullets) para o painel.
export function mdParaHtml(txt) {
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const linhas = esc(txt).split('\n');
  let html = '', emLista = false;
  for (const l of linhas) {
    const b = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    if (/^\s*[-•*]\s+/.test(l)) {
      if (!emLista) { html += '<ul>'; emLista = true; }
      html += `<li>${b.replace(/^\s*[-•*]\s+/, '')}</li>`;
    } else {
      if (emLista) { html += '</ul>'; emLista = false; }
      if (l.trim()) html += `<p>${b}</p>`;
    }
  }
  if (emLista) html += '</ul>';
  return html;
}
