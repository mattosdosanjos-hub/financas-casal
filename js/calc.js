// Funções puras: formatação, mês-fatura e resumo do mês.

export const DINHEIRO_PIX = 'Dinheiro/Pix';

export function moeda(v) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// 'YYYY-MM' -> 'Jul/2026'
export function mesLabel(mesKey) {
  const [ano, mes] = mesKey.split('-').map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

export function mesKeyDe(dataISO) { // 'YYYY-MM-DD' -> 'YYYY-MM'
  return dataISO.slice(0, 7);
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function mesAtualKey() { return hojeISO().slice(0, 7); }

export function addMeses(mesKey, n) {
  const [ano, mes] = mesKey.split('-').map(Number);
  const total = ano * 12 + (mes - 1) + n;
  const a = Math.floor(total / 12);
  const m = total - a * 12 + 1;
  return `${a}-${String(m).padStart(2, '0')}`;
}

export function addMesesData(dataISO, n) {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const alvo = addMeses(`${ano}-${String(mes).padStart(2, '0')}`, n);
  const [a2, m2] = alvo.split('-').map(Number);
  const ultimoDia = new Date(a2, m2, 0).getDate();
  return `${alvo}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`;
}

// Regra do mês-fatura: compra até o dia de fechamento entra na fatura do mês;
// depois do fechamento, vai para o mês seguinte. Dinheiro/Pix = mês da própria data.
export function calcularMesFatura(dataISO, pagamento, cartoes) {
  const mesKey = mesKeyDe(dataISO);
  const cartao = cartoes.find(c => c.nome === pagamento);
  if (!cartao) return mesKey;
  const dia = Number(dataISO.slice(8, 10));
  return dia <= cartao.diaFechamento ? mesKey : addMeses(mesKey, 1);
}

// Dias até o próximo fechamento do cartão (a partir de hoje).
export function diasParaFechar(cartao, hoje = new Date()) {
  const d = hoje.getDate();
  if (d <= cartao.diaFechamento) return cartao.diaFechamento - d;
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return (ultimoDia - d) + Math.min(cartao.diaFechamento, new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0).getDate());
}

// ---------- resumo do mês ----------
// receita = receita real (se lançada) senão a projetada
// limiteCartao = max(receita - gastosFixos - metaAporte, 0)
// disponivel = limiteCartao - gasto em cartões no mês-fatura
export function resumoMes(dados, mesKey) {
  const { lancamentos, despesasFixas, cartoes, config, projecoes, aportes } = dados;
  const doMes = lancamentos.filter(l => l.mesFatura === mesKey);

  const receitaReal = doMes.filter(l => l.tipo === 'Receita').reduce((s, l) => s + l.valor, 0);
  const projecao = projecoes[mesKey] || {};
  const receitaProjetada = projecao.valorProjetado ?? 0;
  const receita = receitaReal > 0 ? receitaReal : receitaProjetada;

  const gastosFixos = despesasFixas.filter(f => f.ativa).reduce((s, f) => s + f.valor, 0);

  // gastos de cartão: tipo Gasto, pagamento = um dos cartões, exceto os gerados por fixas
  const nomesCartoes = new Set(cartoes.map(c => c.nome));
  const gastosCartaoLanc = doMes.filter(l =>
    l.tipo === 'Gasto' && nomesCartoes.has(l.pagamento) && !l.fixaId);
  const totalCartoes = gastosCartaoLanc.reduce((s, l) => s + l.valor, 0);

  const porCartao = {};
  for (const c of cartoes.filter(c => c.ativo)) porCartao[c.nome] = 0;
  for (const l of gastosCartaoLanc) porCartao[l.pagamento] = (porCartao[l.pagamento] ?? 0) + l.valor;

  const gastosAvulsos = doMes
    .filter(l => l.tipo === 'Gasto' && !nomesCartoes.has(l.pagamento) && !l.fixaId)
    .reduce((s, l) => s + l.valor, 0);

  const gastoTotal = doMes.filter(l => l.tipo === 'Gasto').reduce((s, l) => s + l.valor, 0);
  const investidoMes = aportes.filter(a => a.mes === mesKey).reduce((s, a) => s + a.valor, 0);

  const metaAporte = config.metaMensalAporte || 0;
  const limiteCartao = Math.max(receita - gastosFixos - metaAporte, 0);
  const disponivel = limiteCartao - totalCartoes;

  // gasto por categoria (tipo Gasto, inclui fixas geradas)
  const porCategoria = {};
  for (const l of doMes.filter(l => l.tipo === 'Gasto')) {
    porCategoria[l.categoriaId] = (porCategoria[l.categoriaId] ?? 0) + l.valor;
  }

  return {
    mesKey, receita, receitaReal, receitaProjetada, gastosFixos,
    totalCartoes, porCartao, gastosAvulsos, gastoTotal, investidoMes,
    metaAporte, limiteCartao, disponivel, porCategoria,
    fechado: !!projecao.fechadoEm,
  };
}

// Alertas do painel.
export function alertas(dados, resumo, categorias) {
  const out = [];
  const hoje = new Date();
  for (const c of dados.cartoes.filter(c => c.ativo)) {
    const dias = diasParaFechar(c, hoje);
    if (dias <= 2) out.push({ icone: '🔴', txt: `${c.nome} fecha em ${dias === 0 ? 'hoje' : dias + 'd'} — confira a fatura.` });
    else if (dias <= 5) out.push({ icone: '⚠️', txt: `${c.nome} fecha em ${dias} dias.` });
  }
  for (const cat of categorias) {
    if (!cat.orcamentoMensal) continue;
    const gasto = resumo.porCategoria[cat.id] ?? 0;
    if (gasto > cat.orcamentoMensal) {
      out.push({ icone: '💸', txt: `${cat.nome} estourou o orçamento (${moeda(gasto)} de ${moeda(cat.orcamentoMensal)}).` });
    } else if (gasto > cat.orcamentoMensal * 0.85) {
      out.push({ icone: '🟡', txt: `${cat.nome} já usou ${Math.round(gasto / cat.orcamentoMensal * 100)}% do orçamento.` });
    }
  }
  const dia = hoje.getDate();
  if (dia === 1) out.push({ icone: '📌', txt: 'Início do mês: revise as parcelas e a projeção de receita.' });
  if (dia >= 14 && dia <= 16) out.push({ icone: '👀', txt: 'Meio do mês: vale conferir a fatura acumulada dos cartões.' });
  return out;
}

// Insights automáticos (sem IA) para o Painel.
export function insights(dados, resumo, resumoAnterior, categorias) {
  const out = [];
  const hoje = new Date();
  const diaDoMes = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

  // maior categoria
  const entradas = Object.entries(resumo.porCategoria).sort((a, b) => b[1] - a[1]);
  if (entradas.length) {
    const [catId, valor] = entradas[0];
    const cat = categorias.find(c => c.id === catId);
    if (cat && resumo.gastoTotal > 0) {
      out.push({ icone: cat.icone || '📊', txt: `${cat.nome} é sua maior despesa do mês: ${moeda(valor)} (${Math.round(valor / resumo.gastoTotal * 100)}% do total).` });
    }
  }

  // ritmo de gasto vs projeção
  if (resumo.limiteCartao > 0 && diaDoMes > 3) {
    const ritmo = resumo.totalCartoes / diaDoMes;
    const projecaoFim = ritmo * diasNoMes;
    if (projecaoFim > resumo.limiteCartao * 1.05) {
      out.push({ icone: '📈', txt: `No ritmo atual (${moeda(ritmo)}/dia), o cartão fecharia o mês em ${moeda(projecaoFim)} — acima do limite de ${moeda(resumo.limiteCartao)}.` });
    } else if (resumo.totalCartoes > 0) {
      out.push({ icone: '✅', txt: `Ritmo saudável: projeção de ${moeda(projecaoFim)} no cartão até o fim do mês, dentro do limite.` });
    }
  }

  // comparação com mês anterior
  if (resumoAnterior && resumoAnterior.gastoTotal > 0 && resumo.gastoTotal > 0) {
    const diff = resumo.gastoTotal - resumoAnterior.gastoTotal;
    const pct = Math.round(Math.abs(diff) / resumoAnterior.gastoTotal * 100);
    if (pct >= 5) {
      out.push(diff > 0
        ? { icone: '🔺', txt: `Gastos ${pct}% maiores que no mês passado (${moeda(diff)} a mais).` }
        : { icone: '🔻', txt: `Gastos ${pct}% menores que no mês passado (${moeda(-diff)} a menos). Bom trabalho!` });
    }
  }

  // aporte do mês
  if (resumo.metaAporte > 0) {
    if (resumo.investidoMes >= resumo.metaAporte) {
      out.push({ icone: '💎', txt: `Meta de aporte do mês batida: ${moeda(resumo.investidoMes)} investidos.` });
    } else if (diaDoMes > 20) {
      out.push({ icone: '⏳', txt: `Faltam ${moeda(resumo.metaAporte - resumo.investidoMes)} para a meta de aporte deste mês.` });
    }
  }
  return out;
}
