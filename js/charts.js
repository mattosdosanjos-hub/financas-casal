// Gráficos SVG — visuais e minimalistas, pensados para tela de celular.
// Paleta validada com o validador CVD do design system; rótulos diretos
// sempre visíveis cumprem a regra de contraste para cores < 3:1.

import { moeda, moedaCurta, mesLabel } from './calc.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- ARCO (gauge do hero) ----------
// Meio-círculo mostrando quanto do limite já foi usado. Cores claras
// porque vive dentro do card gradiente.
export function arcoGauge(usado, limite) {
  const pct = limite > 0 ? Math.min(usado / limite, 1) : (usado > 0 ? 1 : 0);
  const W = 240, H = 132, cx = W / 2, cy = 118, r = 92, sw = 17;
  const ang = Math.PI * (1 - pct);
  const x = cx + r * Math.cos(ang), y = cy - r * Math.sin(ang);
  const grande = pct > 0.5 ? 1 : 0;
  const trilha = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const arco = pct > 0.004 ? `M ${cx - r} ${cy} A ${r} ${r} 0 ${grande} 1 ${x.toFixed(1)} ${y.toFixed(1)}` : '';
  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:0 auto" role="img" aria-label="Uso do limite">
    <path d="${trilha}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="${sw}" stroke-linecap="round"/>
    ${arco ? `<path d="${arco}" fill="none" stroke="#ffffff" stroke-width="${sw}" stroke-linecap="round"/>` : ''}
    <text x="${cx}" y="${cy - 34}" text-anchor="middle" font-size="13" fill="rgba(255,255,255,.75)" font-weight="600">${Math.round(pct * 100)}% usado</text>
  </svg>`;
}

// ---------- ANEL (progresso de meta) ----------
export function anelProgresso(atual, meta, cor = '#1fa97c') {
  const pct = meta > 0 ? Math.min(atual / meta, 1) : 0;
  const size = 168, c = size / 2, r = 68, sw = 15;
  const circ = 2 * Math.PI * r;
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;margin:0 auto" role="img" aria-label="Progresso da meta">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="${sw}"/>
    ${pct > 0.005 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#ffffff" stroke-width="${sw}"
      stroke-linecap="round" stroke-dasharray="${(pct * circ).toFixed(1)} ${circ}"
      transform="rotate(-90 ${c} ${c})"/>` : ''}
    <text x="${c}" y="${c - 4}" text-anchor="middle" font-size="26" font-weight="700" fill="#fff" class="mono">${(pct * 100).toFixed(0)}%</text>
    <text x="${c}" y="${c + 18}" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.8)">da meta</text>
  </svg>`;
}

// ---------- BARRAS (gasto por mês) ----------
// Barras arredondadas, um número por barra — sem grade, sem eixos pesados.
export function barrasMensais(itens, mesDestaque) { // [{mes:'YYYY-MM', valor}]
  if (itens.length < 2) return `<div class="empty">Aparece a partir do segundo mês de uso.</div>`;
  const ultimos = itens.slice(-6);
  const W = 400, H = 190, padB = 30, padT = 30;
  const max = Math.max(...ultimos.map(i => i.valor), 1);
  const n = ultimos.length;
  const slot = W / n, bw = Math.min(slot * 0.52, 46);

  const barras = ultimos.map((it, i) => {
    const h = Math.max((it.valor / max) * (H - padT - padB), 4);
    const x = slot * i + (slot - bw) / 2;
    const y = H - padB - h;
    const ultimo = mesDestaque ? it.mes === mesDestaque : i === n - 1;
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="10"
        fill="${ultimo ? 'url(#gbar)' : '#e4e1f9'}">
        <title>${mesLabel(it.mes)}: ${moeda(it.valor)}</title>
      </rect>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle"
        font-size="11.5" font-weight="700" class="mono" fill="${ultimo ? '#4356d6' : '#a09db5'}">${moedaCurta(it.valor)}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle"
        font-size="10.5" font-weight="${ultimo ? 700 : 500}" fill="${ultimo ? '#4356d6' : '#a09db5'}">${mesLabel(it.mes).slice(0, 3)}</text>`;
  }).join('');

  return `
  <div class="chart-wrap">
    <svg width="100%" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto por mês">
      <defs><linearGradient id="gbar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7b8cff"/><stop offset="1" stop-color="#5b6ef5"/>
      </linearGradient></defs>
      ${barras}
    </svg>
  </div>`;
}

// ---------- DONUT (categorias) ----------
export function donut(itens, total) {
  const size = 200, cx = size / 2, cy = size / 2, r = 72, stroke = 30;
  if (!itens.length || total <= 0) return `<div class="empty">Sem gastos neste mês ainda.</div>`;

  const circ = 2 * Math.PI * r;
  let offset = 0;
  const gap = 3;
  const segs = itens.map(it => {
    const frac = it.valor / total;
    const len = Math.max(frac * circ - gap, 0.5);
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${it.cor}" stroke-width="${stroke}"
      stroke-dasharray="${len} ${circ - len}"
      stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})">
      <title>${esc(it.nome)}: ${moeda(it.valor)} (${Math.round(frac * 100)}%)</title>
    </circle>`;
    offset += frac * circ;
    return seg;
  }).join('');

  const legenda = itens.map(it => `
    <div class="cat-tile">
      <span class="cat-ico" style="background:${it.cor}1a">${esc(it.icone || '')}</span>
      <div class="cat-info">
        <div class="cat-nome">${esc(it.nome)}</div>
        <div class="cat-valor mono">${moeda(it.valor)}</div>
      </div>
      <span class="cat-pct" style="color:${it.cor}">${Math.round(it.valor / total * 100)}%</span>
    </div>`).join('');

  return `
    <div style="display:flex;justify-content:center;margin:4px 0 10px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Gastos por categoria">
        ${segs}
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="11" fill="#a09db5" font-weight="600">TOTAL</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="16" font-weight="700" class="mono" fill="#191825">${moeda(total)}</text>
      </svg>
    </div>
    <div class="cat-grid">${legenda}</div>`;
}
