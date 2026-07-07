// Funções puras: formatação, mês-fatura, ciclos de fatura e resumo do mês.

export const DINHEIRO_PIX = 'Dinheiro/Pix';

export function moeda(v) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// versão compacta para gráficos: R$ 1,2k / R$ 12k
export function moedaCurta(v) {
  const abs = Math.abs(v);
  if (abs >= 100000) return `${v < 0 ? '-' : ''}${Math.round(abs / 1000)}k`;
  if (abs >= 10000) return `${v < 0 ? '-' : ''}${(abs / 1000).toFixed(1).replace('.', ',')}k`;
  if (abs >= 1000) return `${v < 0 ? '-' : ''}${(abs / 1000).toFixed(1).replace('.', ',')}k`;
  return `${v < 0 ? '-' : ''}${Math.round(abs)}`;
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function mesLabel(mesKey) {
  const [ano, mes] = mesKey.split('-').map(Number);
  return `${MESES[mes - 1]}/${ano}`;
}

export function mesKeyDe(dataISO) { return dataISO.slice(0, 7); }

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

// Ciclo (fatura) aberto de um cartão hoje: se ainda não fechou, é o mês corrente;
// se já fechou, é o mês seguinte.
export function cicloAberto(cartao, hoje = new Date()) {
  const mes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  return hoje.getDate() <= cartao.diaFechamento ? mes : addMeses(mes, 1);
}

// Último ciclo que já fechou.
export function ultimoCicloFechado(cartao, hoje = new Date()) {
  return addMeses(cicloAberto(cartao, hoje), -1);
}

export function diasParaFechar(cartao, hoje = new Date()) {
  const d = hoje.getDate();
  if (d <= cartao.diaFechamento) return cartao.diaFechamento - d;
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return (ultimoDia - d) + Math.min(cartao.diaFechamento, new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0).getDate());
}

// Último valor de fatura informado manualmente para um cartão num ciclo.
export function faturaInformada(dados, cartaoId, ciclo) {
  const regs = dados.registrosFatura
    .filter(r => r.cartaoId === cartaoId && r.ciclo === ciclo)
    .sort((a, b) => b.m - a.m);
  return regs[0] || null;
}

// Soma das despesas fixas ativas pagas num cartão (para não contar duas vezes
// ao comparar a fatura informada com o limite disponível).
export function fixasNoCartao(dados, nomeCartao) {
  return dados.despesasFixas
    .filter(f => f.ativa && f.pagamento === nomeCartao)
    .reduce((s, f) => s + f.valor, 0);
}

// Gasto "efetivo" de cada cartão num ciclo:
//   max( lançamentos avulsos no app , fatura (fechada ou informada) − fixas do cartão )
// A fatura do banco é a fonte da verdade quando informada; os lançamentos
// cobrem o que ainda não foi refletido nela.
export function gastoCartoesEfetivo(dados, mesKey) {
  const porCartao = {};
  let total = 0, totalLancado = 0;
  for (const c of dados.cartoes.filter(c => c.ativo)) {
    const lancado = dados.lancamentos
      .filter(l => l.tipo === 'Gasto' && l.pagamento === c.nome && l.mesFatura === mesKey && !l.fixaId)
      .reduce((s, l) => s + l.valor, 0);
    const fechada = dados.faturasFechadas?.[c.id]?.[mesKey]?.valor;
    const informada = faturaInformada(dados, c.id, mesKey)?.valor;
    const bruta = fechada ?? informada;
    const faturaAjustada = bruta != null ? Math.max(bruta - fixasNoCartao(dados, c.nome), 0) : null;
    const efetivo = faturaAjustada != null ? Math.max(lancado, faturaAjustada) : lancado;
    porCartao[c.nome] = { lancado, fatura: bruta ?? null, fechada: fechada != null, efetivo };
    total += efetivo;
    totalLancado += lancado;
  }
  return { porCartao, total, totalLancado };
}

// ---------- resumo do mês ----------
export function resumoMes(dados, mesKey) {
  const { lancamentos, despesasFixas, config, projecoes, aportes } = dados;
  const doMes = lancamentos.filter(l => l.mesFatura === mesKey);

  const receitaReal = doMes.filter(l => l.tipo === 'Receita').reduce((s, l) => s + l.valor, 0);
  const projecao = projecoes[mesKey] || {};
  const receitaProjetada = projecao.valorProjetado ?? 0;
  const receita = receitaReal > 0 ? receitaReal : receitaProjetada;

  const gastosFixos = despesasFixas.filter(f => f.ativa).reduce((s, f) => s + f.valor, 0);

  const cartoesEf = gastoCartoesEfetivo(dados, mesKey);
  const totalCartoes = cartoesEf.total;

  const nomesCartoes = new Set(dados.cartoes.map(c => c.nome));
  const gastosAvulsos = doMes
    .filter(l => l.tipo === 'Gasto' && !nomesCartoes.has(l.pagamento) && !l.fixaId)
    .reduce((s, l) => s + l.valor, 0);

  // gasto total do mês usando o efetivo dos cartões (fatura ou lançado, o maior)
  const gastoLancadoTotal = doMes.filter(l => l.tipo === 'Gasto').reduce((s, l) => s + l.valor, 0);
  const gastoTotal = gastoLancadoTotal - cartoesEf.totalLancado + totalCartoes;

  const investidoMes = aportes.filter(a => a.mes === mesKey).reduce((s, a) => s + a.valor, 0);

  const metaAporte = config.metaMensalAporte || 0;
  const limiteCartao = Math.max(receita - gastosFixos - metaAporte, 0);
  const disponivel = limiteCartao - totalCartoes;

  const porCategoria = {};
  for (const l of doMes.filter(l => l.tipo === 'Gasto')) {
    porCategoria[l.categoriaId] = (porCategoria[l.categoriaId] ?? 0) + l.valor;
  }

  return {
    mesKey, receita, receitaReal, receitaProjetada, gastosFixos,
    totalCartoes, cartoesEf, gastosAvulsos, gastoTotal, investidoMes,
    metaAporte, limiteCartao, disponivel, porCategoria,
    fechado: !!projecao.fechadoEm,
  };
}

// Alertas do painel.
export function alertas(dados, resumo, categorias) {
  const out = [];
  const hoje = new Date();
  for (const c of dados.cartoes.filter(c => c.ativo)) {
    const cicloFechado = ultimoCicloFechado(c, hoje);
    const temMovimento = dados.lancamentos.some(l => l.pagamento === c.nome && l.mesFatura === cicloFechado)
      || faturaInformada(dados, c.id, cicloFechado);
    if (temMovimento && !dados.faturasFechadas?.[c.id]?.[cicloFechado]) {
      out.push({ icone: '🧾', txt: `A fatura ${mesLabel(cicloFechado)} do ${c.nome} fechou — informe o valor final.`, acao: 'fechar-fatura', cartaoId: c.id, ciclo: cicloFechado });
      continue;
    }
    const dias = diasParaFechar(c, hoje);
    if (dias <= 2) out.push({ icone: '🔴', txt: `${c.nome} fecha ${dias === 0 ? 'hoje' : 'em ' + dias + 'd'} — atualize o valor da fatura.` });
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
  if (dia >= 14 && dia <= 16) out.push({ icone: '👀', txt: 'Meio do mês: vale atualizar o valor das faturas.' });
  return out;
}

// Insights automáticos (sem IA) para o Painel.
export function insights(dados, resumo, resumoAnterior, categorias) {
  const out = [];
  const hoje = new Date();
  const diaDoMes = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

  // diferença entre fatura informada e lançado (gastos não categorizados)
  for (const [nome, info] of Object.entries(resumo.cartoesEf.porCartao)) {
    if (info.fatura != null && info.efetivo > info.lancado + 1) {
      out.push({ icone: '🕵️', txt: `${nome}: ${moeda(info.efetivo - info.lancado)} da fatura ainda não foram lançados por categoria.` });
      break; // um por vez para não poluir
    }
  }

  const entradas = Object.entries(resumo.porCategoria).sort((a, b) => b[1] - a[1]);
  if (entradas.length) {
    const [catId, valor] = entradas[0];
    const cat = categorias.find(c => c.id === catId);
    if (cat && resumo.gastoTotal > 0) {
      out.push({ icone: cat.icone || '📊', txt: `${cat.nome} é sua maior despesa do mês: ${moeda(valor)} (${Math.round(valor / resumo.gastoTotal * 100)}% do total).` });
    }
  }

  if (resumo.limiteCartao > 0 && diaDoMes > 3) {
    const ritmo = resumo.totalCartoes / diaDoMes;
    const projecaoFim = ritmo * diasNoMes;
    if (projecaoFim > resumo.limiteCartao * 1.05) {
      out.push({ icone: '📈', txt: `No ritmo atual (${moeda(ritmo)}/dia), o cartão fecharia o mês em ${moeda(projecaoFim)} — acima do limite de ${moeda(resumo.limiteCartao)}.` });
    } else if (resumo.totalCartoes > 0) {
      out.push({ icone: '✅', txt: `Ritmo saudável: projeção de ${moeda(projecaoFim)} no cartão até o fim do mês, dentro do limite.` });
    }
  }

  if (resumoAnterior && resumoAnterior.gastoTotal > 0 && resumo.gastoTotal > 0) {
    const diff = resumo.gastoTotal - resumoAnterior.gastoTotal;
    const pct = Math.round(Math.abs(diff) / resumoAnterior.gastoTotal * 100);
    if (pct >= 5) {
      out.push(diff > 0
        ? { icone: '🔺', txt: `Gastos ${pct}% maiores que no mês passado (${moeda(diff)} a mais).` }
        : { icone: '🔻', txt: `Gastos ${pct}% menores que no mês passado (${moeda(-diff)} a menos). Bom trabalho!` });
    }
  }

  if (resumo.metaAporte > 0) {
    if (resumo.investidoMes >= resumo.metaAporte) {
      out.push({ icone: '💎', txt: `Meta de aporte do mês batida: ${moeda(resumo.investidoMes)} investidos.` });
    } else if (diaDoMes > 20) {
      out.push({ icone: '⏳', txt: `Faltam ${moeda(resumo.metaAporte - resumo.investidoMes)} para a meta de aporte deste mês.` });
    }
  }
  return out;
}
