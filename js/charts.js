// Gráficos em SVG puro — donut (categorias) e linha (evolução mensal).
// Identidade visual validada com o validador de paleta (CVD-safe);
// rótulos diretos sempre visíveis cumprem a regra de "relief" para cores < 3:1.

import { moeda, mesLabel } from './calc.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- DONUT ----------
// itens: [{nome, valor, cor, icone}]
export function donut(itens, total) {
  const size = 190, cx = size / 2, cy = size / 2, r = 70, stroke = 26;
  if (!itens.length || total <= 0) return `<div class="empty">Sem gastos neste mês ainda.</div>`;

  const circ = 2 * Math.PI * r;
  let offset = 0;
  const gap = 2.5; // px de respiro entre segmentos
  const segs = itens.map(it => {
    const frac = it.valor / total;
    const len = Math.max(frac * circ - gap, 0.5);
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${it.cor}" stroke-width="${stroke}"
      stroke-dasharray="${len} ${circ - len}"
      stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"
      stroke-linecap="butt">
      <title>${esc(it.nome)}: ${moeda(it.valor)} (${Math.round(frac * 100)}%)</title>
    </circle>`;
    offset += frac * circ;
    return seg;
  }).join('');

  const legenda = itens.map(it => `
    <div class="row">
      <span class="l"><span class="dot" style="background:${it.cor}"></span><span class="txt">${esc(it.icone || '')} ${esc(it.nome)}</span></span>
      <span class="r">${moeda(it.valor)} <span class="muted" style="font-weight:400">· ${Math.round(it.valor / total * 100)}%</span></span>
    </div>`).join('');

  return `
    <div style="display:flex;justify-content:center">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Gastos por categoria">
        ${segs}
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="11" fill="#898781">Total</text>
        <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="15" font-weight="700" class="mono" fill="#1c1b18">${moeda(total)}</text>
      </svg>
    </div>
    <div class="legend">${legenda}</div>`;
}

// ---------- LINHA (evolução mensal) ----------
// series: { meses: ['YYYY-MM'...], receita: [], gasto: [], saldo: [] }
export function linhaEvolucao(s) {
  const n = s.meses.length;
  if (n < 2) return `<div class="empty">O gráfico de evolução aparece a partir do segundo mês de uso.</div>`;

  const W = 400, H = 210, padL = 8, padR = 46, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;

  const todos = [...s.receita, ...s.gasto, ...s.saldo];
  let min = Math.min(0, ...todos), max = Math.max(...todos, 100);
  const range = max - min || 1;
  max += range * 0.08; min -= range * 0.05;

  const x = i => padL + (i / (n - 1)) * iw;
  const y = v => padT + (1 - (v - min) / (max - min)) * ih;

  const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const pontos = (arr, cor) => arr.map((v, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.4" fill="${cor}" stroke="#fff" stroke-width="1.6">
       <title>${mesLabel(s.meses[i])}: ${moeda(v)}</title></circle>`).join('');

  const cores = { receita: '#1fa97c', gasto: '#ef5757', saldo: '#5b6ef5' };
  const linhaZero = min < 0
    ? `<line x1="${padL}" x2="${W - padR}" y1="${y(0)}" y2="${y(0)}" stroke="#c3c2b7" stroke-dasharray="3 3" stroke-width="1"/>`
    : '';

  const labelsX = s.meses.map((m, i) =>
    (n <= 6 || i % 2 === (n - 1) % 2)
      ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#898781">${mesLabel(m).slice(0, 3)}</text>`
      : '').join('');

  // rótulos diretos no último ponto de cada série (evita colisão espaçando)
  const fim = [
    { k: 'receita', label: 'Receita' }, { k: 'gasto', label: 'Gasto' }, { k: 'saldo', label: 'Saldo' },
  ].map(o => ({ ...o, yv: y(s[o.k][n - 1]) })).sort((a, b) => a.yv - b.yv);
  for (let i = 1; i < fim.length; i++) if (fim[i].yv - fim[i - 1].yv < 13) fim[i].yv = fim[i - 1].yv + 13;
  const labelsFim = fim.map(o =>
    `<text x="${W - padR + 5}" y="${o.yv + 3.5}" font-size="10" font-weight="600" fill="${cores[o.k]}">${o.label}</text>`).join('');

  const grid = [0.25, 0.5, 0.75].map(f =>
    `<line x1="${padL}" x2="${W - padR}" y1="${padT + f * ih}" y2="${padT + f * ih}" stroke="#eceae4" stroke-width="1"/>`).join('');

  return `
  <div class="chart-wrap">
    <svg width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução mensal de receita, gasto e saldo">
      ${grid}${linhaZero}
      <path d="${path(s.receita)}" fill="none" stroke="${cores.receita}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="${path(s.gasto)}"   fill="none" stroke="${cores.gasto}"   stroke-width="2.2" stroke-linejoin="round"/>
      <path d="${path(s.saldo)}"   fill="none" stroke="${cores.saldo}"   stroke-width="2.2" stroke-linejoin="round"/>
      ${pontos(s.receita, cores.receita)}${pontos(s.gasto, cores.gasto)}${pontos(s.saldo, cores.saldo)}
      ${labelsX}${labelsFim}
    </svg>
  </div>`;
}
