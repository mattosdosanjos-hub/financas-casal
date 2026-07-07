// Finanças T&D — app principal (telas, navegação e interações) v2

import {
  db, save, onSave, novoId, tocar, marcarExcluido, substituir,
  exportarJSON, importarJSON, resetarTudo, gerarCodigoCasal,
} from './store.js';
import {
  moeda, mesLabel, mesAtualKey, hojeISO, addMeses, addMesesData,
  calcularMesFatura, diasParaFechar, cicloAberto, ultimoCicloFechado,
  faturaInformada, resumoMes, alertas, insights, DINHEIRO_PIX,
} from './calc.js';
import { arcoGauge, anelProgresso, barrasMensais, donut } from './charts.js';
import { analisarComClaude, montarContexto, mdParaHtml } from './ia.js';
import { iniciarSync, sincronizar, agendarPush, syncAtivo, onSyncStatus, entrarComCodigo, mesclar } from './sync.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let viewAtual = 'painel';

/* ================= util UI ================= */

function toast(msg, erro = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (erro ? ' err' : '');
  el.textContent = msg;
  $('#toastRoot').appendChild(el);
  if (navigator.vibrate) navigator.vibrate(erro ? [60, 40, 60] : 35);
  setTimeout(() => el.remove(), 2600);
}

function modal(html, aoMontar) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-back"><div class="modal">${html}</div></div>`;
  root.querySelector('.modal-back').addEventListener('click', e => {
    if (e.target.classList.contains('modal-back')) fecharModal();
  });
  if (aoMontar) aoMontar(root.querySelector('.modal'));
}
function fecharModal() { $('#modalRoot').innerHTML = ''; }

function valorBR(str) {
  if (typeof str !== 'string') return Number(str) || 0;
  const limpo = str.trim().replace(/\./g, '').replace(',', '.');
  const alt = str.trim().replace(',', '.');
  const v = Number(limpo);
  return Number.isFinite(v) && v !== 0 ? v : (Number(alt) || 0);
}

/* ============ geração de fixas do mês ============ */

function gerarFixasDoMes() {
  const dados = db();
  const mes = mesAtualKey();
  if (dados.fixasGeradas[mes]) return;
  const fixas = dados.despesasFixas.filter(f => f.ativa);
  for (const f of fixas) {
    const dia = Math.min(f.diaVencimento || 1, new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate());
    dados.lancamentos.push(tocar({
      id: novoId(), tipo: 'Gasto', descricao: f.descricao, valor: f.valor,
      data: `${mes}-${String(dia).padStart(2, '0')}`,
      categoriaId: f.categoriaId, pagamento: f.pagamento || DINHEIRO_PIX,
      mesFatura: mes, fixaId: f.id, criadoEm: Date.now(),
    }));
  }
  dados.fixasGeradas[mes] = true;
  save();
  if (fixas.length) toast(`${fixas.length} despesa(s) fixa(s) lançada(s) para ${mesLabel(mes)}`);
}

/* ================= PAINEL ================= */

function renderPainel() {
  const dados = db();
  const mes = mesAtualKey();
  const r = resumoMes(dados, mes);
  const rAnt = resumoMes(dados, addMeses(mes, -1));
  const cats = dados.categorias;

  const estado = r.disponivel < 0 ? 'alerta' : '';
  const cartoesAtivos = dados.cartoes.filter(c => c.ativo);

  const faturasHtml = cartoesAtivos.map(c => {
    const ciclo = cicloAberto(c);
    const cicloFechado = ultimoCicloFechado(c);
    const info = r.cartoesEf.porCartao[c.nome] || { lancado: 0, fatura: null, efetivo: 0 };
    const dias = diasParaFechar(c);
    const badge = dias <= 2 ? `<span class="badge hot">fecha ${dias === 0 ? 'hoje' : 'em ' + dias + 'd'}</span>`
      : dias <= 5 ? `<span class="badge warn">fecha em ${dias}d</span>`
      : `<span class="badge">fecha em ${dias}d</span>`;

    const pendenteFechar = !dados.faturasFechadas?.[c.id]?.[cicloFechado] &&
      (dados.lancamentos.some(l => l.pagamento === c.nome && l.mesFatura === cicloFechado) || faturaInformada(dados, c.id, cicloFechado));

    const regAtual = faturaInformada(dados, c.id, ciclo);
    const infoTxt = regAtual
      ? `fatura informada em ${regAtual.data.slice(8, 10)}/${regAtual.data.slice(5, 7)} · lançado ${moeda(info.lancado)}`
      : `lançado no app ${moeda(info.lancado)} · fatura ainda não informada`;

    return `<div class="fatura-card">
      <div class="fatura-top">
        <span class="fatura-nome">${esc(c.nome)}${badge}</span>
        <span class="fatura-valor">${moeda(regAtual?.valor ?? info.lancado)}</span>
      </div>
      <div class="fatura-meta">
        <span class="fatura-info">${infoTxt}</span>
        ${pendenteFechar
          ? `<button class="fatura-acao urgente" data-fechar="${c.id}" data-ciclo="${cicloFechado}">fechar ${mesLabel(cicloFechado).slice(0, 3)}</button>`
          : `<button class="fatura-acao" data-atualizar="${c.id}" data-ciclo="${ciclo}">atualizar</button>`}
      </div>
    </div>`;
  }).join('');

  const listaAlertas = alertas(dados, r, cats);
  const listaInsights = insights(dados, r, rAnt, cats);

  $('#view').innerHTML = `
    <div class="hero-grad ${estado}">
      ${arcoGauge(r.totalCartoes, r.limiteCartao)}
      <div class="label">Disponível para gastar</div>
      <div class="valor">${moeda(r.disponivel)}</div>
      <div class="hero-pills">
        <span class="hero-pill">nos cartões <b>${moeda(r.totalCartoes)}</b></span>
        <span class="hero-pill">limite <b>${moeda(r.limiteCartao)}</b></span>
      </div>
    </div>

    <div class="grid2">
      <div class="stat" id="cardReceita" style="cursor:pointer">
        <span class="emoji">${r.receitaReal > 0 ? '💰' : '✏️'}</span>
        <div class="k">${r.receitaReal > 0 ? 'Receita (real)' : 'Projeção de receita'}</div>
        <div class="v pos">${moeda(r.receita)}</div>
      </div>
      <div class="stat">
        <span class="emoji">🎯</span>
        <div class="k">Meta de aporte</div>
        <div class="v" style="color:var(--indigo-dark)">${moeda(r.metaAporte)}</div>
      </div>
    </div>

    <div class="card">
      <h3>Faturas · ${mesLabel(mes)} <span class="muted" style="letter-spacing:0;text-transform:none;font-weight:600">${moeda(r.totalCartoes)}</span></h3>
      ${faturasHtml || '<div class="empty">Nenhum cartão ativo.</div>'}
    </div>

    <div class="card">
      <details>
        <summary><div class="row" style="padding:0;border:none">
          <span class="l">🧾 Gastos fixos do mês</span><span class="r">${moeda(r.gastosFixos)}</span>
        </div></summary>
        <div style="margin-top:10px">
          ${dados.despesasFixas.filter(f => f.ativa).map(f => {
            const c = cats.find(c => c.id === f.categoriaId);
            return `<div class="row"><span class="l"><span class="txt">${esc(c?.icone || '')} ${esc(f.descricao)}</span></span><span class="r">${moeda(f.valor)}</span></div>`;
          }).join('') || '<div class="empty">Cadastre suas despesas fixas em Config.</div>'}
        </div>
      </details>
    </div>

    ${listaAlertas.length ? `<div class="card"><h3>Alertas</h3>${listaAlertas.map(a =>
      `<div class="alerta"><span class="ico">${a.icone}</span><span>${esc(a.txt)}</span>${a.acao === 'fechar-fatura'
        ? `<button class="alerta-btn" data-fechar="${a.cartaoId}" data-ciclo="${a.ciclo}">informar</button>` : ''}</div>`).join('')}</div>` : ''}

    <div class="card">
      <h3>Insights <button class="btn btn-sm btn-ghost" id="btnIA" style="box-shadow:none;background:#eef0fe;color:var(--indigo-dark)">✨ Análise IA</button></h3>
      ${listaInsights.map(i => `<div class="insight"><span class="ico">${i.icone}</span><span>${esc(i.txt)}</span></div>`).join('')
        || '<div class="empty">Lance alguns gastos para ver insights aqui.</div>'}
      <div id="iaResultado"></div>
    </div>

    <button class="btn btn-ghost" id="btnFecharMes">🔒 Fechar as contas do mês${r.fechado ? ' <span class="badge ok">fechado</span>' : ''}</button>
    <div style="height:8px"></div>
  `;

  $('#cardReceita').addEventListener('click', () => abrirModalProjecao(mes, r));
  $('#btnFecharMes').addEventListener('click', () => abrirModalFecharMes(mes, r));
  $('#btnIA').addEventListener('click', () => rodarAnaliseIA(dados, r, cats));
  document.querySelectorAll('[data-atualizar]').forEach(b =>
    b.onclick = () => abrirModalFaturaAtual(b.dataset.atualizar, b.dataset.ciclo));
  document.querySelectorAll('[data-fechar]').forEach(b =>
    b.onclick = () => abrirModalFecharFatura(b.dataset.fechar, b.dataset.ciclo));
}

// "a fatura está em X hoje"
function abrirModalFaturaAtual(cartaoId, ciclo) {
  const dados = db();
  const c = dados.cartoes.find(c => c.id === cartaoId);
  const atual = faturaInformada(dados, cartaoId, ciclo);
  modal(`
    <h2>${esc(c.nome)} · fatura ${mesLabel(ciclo)}</h2>
    <p class="small muted" style="margin-bottom:6px">Abra o app do banco e informe quanto está a fatura <strong>hoje</strong>. O painel passa a usar esse valor.</p>
    <input class="valor-input" id="inpFat" inputmode="decimal" placeholder="0,00"
      value="${atual ? String(atual.valor).replace('.', ',') : ''}">
    <div class="modal-actions">
      <button class="btn btn-ghost" id="mCancelar">Cancelar</button>
      <button class="btn btn-primary" id="mSalvar">Salvar</button>
    </div>`, m => {
    m.querySelector('#mCancelar').onclick = fecharModal;
    m.querySelector('#mSalvar').onclick = () => {
      const v = valorBR(m.querySelector('#inpFat').value);
      if (!(v >= 0)) { toast('Valor inválido', true); return; }
      dados.registrosFatura.push(tocar({ id: novoId(), cartaoId, ciclo, data: hojeISO(), valor: v }));
      save(); fecharModal(); toast('Fatura atualizada 💳'); renderPainel();
    };
    m.querySelector('#inpFat').focus();
  });
}

// fatura fechou → valor final
function abrirModalFecharFatura(cartaoId, ciclo) {
  const dados = db();
  const c = dados.cartoes.find(c => c.id === cartaoId);
  const ultimo = faturaInformada(dados, cartaoId, ciclo);
  modal(`
    <h2>Fechar fatura · ${esc(c.nome)}</h2>
    <p class="small muted" style="margin-bottom:6px">A fatura <strong>${mesLabel(ciclo)}</strong> fechou dia ${c.diaFechamento}. Informe o valor final que apareceu no banco.</p>
    <input class="valor-input" id="inpFat" inputmode="decimal" placeholder="0,00"
      value="${ultimo ? String(ultimo.valor).replace('.', ',') : ''}">
    <div class="modal-actions">
      <button class="btn btn-ghost" id="mCancelar">Depois</button>
      <button class="btn btn-primary" id="mSalvar">Fechar fatura</button>
    </div>`, m => {
    m.querySelector('#mCancelar').onclick = fecharModal;
    m.querySelector('#mSalvar').onclick = () => {
      const v = valorBR(m.querySelector('#inpFat').value);
      if (!(v >= 0)) { toast('Valor inválido', true); return; }
      dados.faturasFechadas[cartaoId] ??= {};
      dados.faturasFechadas[cartaoId][ciclo] = { valor: v, fechadaEm: new Date().toISOString(), m: Date.now() };
      save(); fecharModal(); toast(`Fatura ${mesLabel(ciclo)} fechada ✓`); renderPainel();
    };
    m.querySelector('#inpFat').focus();
  });
}

function abrirModalProjecao(mes, r) {
  modal(`
    <h2>Projeção de receita · ${mesLabel(mes)}</h2>
    <p class="small muted" style="margin-bottom:8px">Usada enquanto a receita real não for lançada.</p>
    <input class="valor-input" id="inpProjecao" inputmode="decimal" placeholder="0,00"
      value="${r.receitaProjetada ? String(r.receitaProjetada).replace('.', ',') : ''}">
    <div class="modal-actions">
      <button class="btn btn-ghost" id="mCancelar">Cancelar</button>
      <button class="btn btn-primary" id="mSalvar">Salvar</button>
    </div>`, m => {
    m.querySelector('#mCancelar').onclick = fecharModal;
    m.querySelector('#mSalvar').onclick = () => {
      const v = valorBR(m.querySelector('#inpProjecao').value);
      const dados = db();
      dados.projecoes[mes] = { ...(dados.projecoes[mes] || {}), valorProjetado: v, m: Date.now() };
      save(); fecharModal(); toast('Projeção salva'); renderPainel();
    };
    m.querySelector('#inpProjecao').focus();
  });
}

function abrirModalFecharMes(mes, r) {
  const saldoFinal = r.receitaReal - r.gastoTotal - r.investidoMes;
  const aviso = r.receitaReal === 0
    ? `<p class="small" style="color:var(--amber);margin:8px 0">⚠️ A receita real ainda não foi lançada — o saldo abaixo considera receita R$ 0,00.</p>` : '';
  modal(`
    <h2>Fechar ${mesLabel(mes)}</h2>
    ${aviso}
    <div class="card" style="margin-top:8px">
      <div class="row"><span class="l">Projetado</span><span class="r">${moeda(r.receitaProjetada)}</span></div>
      <div class="row"><span class="l">Receita real</span><span class="r pos">${moeda(r.receitaReal)}</span></div>
      <div class="row"><span class="l">Gastos totais</span><span class="r neg">${moeda(r.gastoTotal)}</span></div>
      <div class="row"><span class="l">— nos cartões</span><span class="r">${moeda(r.totalCartoes)}</span></div>
      <div class="row"><span class="l">Investido</span><span class="r" style="color:var(--indigo-dark)">${moeda(r.investidoMes)}</span></div>
      <div class="row"><span class="l"><strong>Saldo final</strong></span><span class="r ${saldoFinal >= 0 ? 'pos' : 'neg'}">${moeda(saldoFinal)}</span></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="mCancelar">Cancelar</button>
      <button class="btn btn-primary" id="mConfirmar">Confirmar</button>
    </div>`, m => {
    m.querySelector('#mCancelar').onclick = fecharModal;
    m.querySelector('#mConfirmar').onclick = () => {
      const dados = db();
      dados.projecoes[mes] = {
        ...(dados.projecoes[mes] || {}),
        valorRealizado: r.receitaReal, fechadoEm: new Date().toISOString(), m: Date.now(),
      };
      save(); fecharModal(); toast(`${mesLabel(mes)} fechado 🔒`); renderPainel();
    };
  });
}

async function rodarAnaliseIA(dados, r, cats) {
  const alvo = $('#iaResultado');
  if (!dados.config.apiKeyIA) {
    alvo.innerHTML = `<div class="empty">Para usar a análise com IA, salve sua chave da API Anthropic em <strong>Config → Assistente IA</strong>.</div>`;
    return;
  }
  alvo.innerHTML = `<div class="empty"><span class="spinner"></span> Analisando suas finanças…</div>`;
  try {
    const historico = mesesComDados(dados).slice(0, 6).map(m => resumoMes(dados, m));
    const contexto = montarContexto(dados, r, historico, cats);
    const texto = await analisarComClaude(dados.config.apiKeyIA, contexto);
    alvo.innerHTML = `<div class="ia-box" style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px">${mdParaHtml(texto)}</div>`;
  } catch (e) {
    alvo.innerHTML = `<div class="empty" style="color:var(--coral)">${esc(e.message)}</div>`;
  }
}

/* ================= LANÇAR ================= */

const formState = { tipo: 'Gasto', categoriaId: null, pagamento: DINHEIRO_PIX };

function renderLancar() {
  const dados = db();
  const cats = dados.categorias.filter(c => !['Receita', 'Investimento'].includes(c.nome));
  if (!formState.categoriaId) formState.categoriaId = cats[0]?.id;

  const pagamentos = [...dados.cartoes.filter(c => c.ativo).map(c => c.nome), DINHEIRO_PIX];

  $('#view').innerHTML = `
    <div class="card">
      <label class="f" style="margin-top:0">Tipo</label>
      <div class="chips" id="chipsTipo">
        ${['Gasto', 'Receita', 'Investimento'].map(t =>
          `<button class="chip tipo-${t.toLowerCase()} ${formState.tipo === t ? 'active' : ''}" data-t="${t}">${{ Gasto: '💸', Receita: '💰', Investimento: '💎' }[t]} ${t}</button>`).join('')}
      </div>

      <label class="f">Valor</label>
      <input class="valor-input" id="inpValor" inputmode="decimal" placeholder="0,00" autocomplete="off">

      <div id="blocoGasto">
        <label class="f">Categoria</label>
        <div class="chips scroll" id="chipsCat">
          ${cats.map(c => `<button class="chip ${formState.categoriaId === c.id ? 'active' : ''}" data-c="${c.id}">${c.icone} ${esc(c.nome)}</button>`).join('')}
        </div>

        <label class="f">Pagamento</label>
        <div class="chips scroll" id="chipsPag">
          ${pagamentos.map(p => `<button class="chip ${formState.pagamento === p ? 'active' : ''}" data-p="${esc(p)}">${p === DINHEIRO_PIX ? '💵' : '💳'} ${esc(p)}</button>`).join('')}
        </div>
        <div class="small muted" id="hintFatura" style="margin-top:8px"></div>
      </div>

      <div class="form-row2">
        <div>
          <label class="f">Data</label>
          <input type="date" id="inpData" value="${hojeISO()}">
        </div>
        <div id="blocoParcelas">
          <label class="f">Parcelas</label>
          <input type="number" id="inpParcelas" min="1" max="48" value="1" inputmode="numeric">
        </div>
      </div>

      <label class="f">Descrição <span class="muted" style="font-weight:500">(opcional)</span></label>
      <input id="inpDesc" placeholder="Ex.: mercado da semana" autocomplete="off">

      <div style="height:18px"></div>
      <button class="btn btn-primary" id="btnSalvar">Salvar lançamento</button>
    </div>

    <div class="card">
      <h3>Últimos lançamentos</h3>
      <div id="ultimos">${ultimosLancamentosHtml(dados)}</div>
    </div>
  `;

  const atualizarHint = () => {
    const data = $('#inpData').value || hojeISO();
    const mf = calcularMesFatura(data, formState.pagamento, dados.cartoes);
    $('#hintFatura').textContent = formState.pagamento === DINHEIRO_PIX
      ? `Entra no mês ${mesLabel(mf)}.`
      : `Entra na fatura de ${mesLabel(mf)}.`;
  };
  const atualizarBlocos = () => {
    $('#blocoGasto').style.display = formState.tipo === 'Gasto' ? '' : 'none';
    $('#blocoParcelas').style.display = formState.tipo === 'Gasto' ? '' : 'none';
  };
  atualizarHint(); atualizarBlocos();

  $('#chipsTipo').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    formState.tipo = b.dataset.t;
    renderLancar();
    $('#inpValor').focus();
  });
  $('#chipsCat')?.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    formState.categoriaId = b.dataset.c;
    $('#chipsCat').querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === b));
  });
  $('#chipsPag')?.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    formState.pagamento = b.dataset.p;
    $('#chipsPag').querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === b));
    atualizarHint();
  });
  $('#inpData').addEventListener('change', atualizarHint);

  $('#btnSalvar').addEventListener('click', () => salvarLancamento(dados));
  $('#inpValor').focus();
}

function salvarLancamento(dados) {
  const valor = valorBR($('#inpValor').value);
  const data = $('#inpData').value || hojeISO();
  const parcelas = formState.tipo === 'Gasto' ? Math.max(1, Number($('#inpParcelas').value) || 1) : 1;
  if (!(valor > 0)) { toast('Informe um valor maior que zero', true); return; }

  const btn = $('#btnSalvar');
  btn.disabled = true; btn.innerHTML = '<span class="spinner" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>';

  const cats = db().categorias;
  let categoriaId = formState.categoriaId;
  if (formState.tipo === 'Receita') categoriaId = cats.find(c => c.nome === 'Receita')?.id;
  if (formState.tipo === 'Investimento') categoriaId = cats.find(c => c.nome === 'Investimento')?.id;
  const cat = cats.find(c => c.id === categoriaId);
  const descricao = $('#inpDesc').value.trim() || cat?.nome || formState.tipo;
  const pagamento = formState.tipo === 'Gasto' ? formState.pagamento : DINHEIRO_PIX;

  if (formState.tipo === 'Investimento') {
    registrarAporte(dados, valor, data);
  } else {
    const grupo = parcelas > 1 ? novoId() : null;
    const valorParcela = Math.round((valor / parcelas) * 100) / 100;
    for (let i = 0; i < parcelas; i++) {
      const dataP = i === 0 ? data : addMesesData(data, i);
      dados.lancamentos.push(tocar({
        id: novoId(), tipo: formState.tipo, descricao, valor: valorParcela,
        data: dataP, categoriaId, pagamento,
        mesFatura: calcularMesFatura(dataP, pagamento, dados.cartoes),
        parcelaAtual: parcelas > 1 ? i + 1 : null,
        parcelaTotal: parcelas > 1 ? parcelas : null,
        grupoParcelamento: grupo, criadoEm: Date.now(),
      }));
    }
    save();
  }

  setTimeout(() => {
    toast(parcelas > 1 ? `Salvo em ${parcelas}x ✓` : 'Lançamento salvo ✓');
    $('#inpValor').value = ''; $('#inpDesc').value = ''; $('#inpParcelas').value = '1';
    btn.disabled = false; btn.textContent = 'Salvar lançamento';
    $('#ultimos').innerHTML = ultimosLancamentosHtml(db());
    $('#inpValor').focus();
  }, 120);
}

function registrarAporte(dados, valor, data) {
  const mes = data.slice(0, 7);
  const catInvest = dados.categorias.find(c => c.nome === 'Investimento');
  const lanc = tocar({
    id: novoId(), tipo: 'Investimento', descricao: 'Aporte investimento', valor,
    data, categoriaId: catInvest?.id, pagamento: DINHEIRO_PIX,
    mesFatura: mes, criadoEm: Date.now(),
  });
  dados.lancamentos.push(lanc);
  const existente = dados.aportes.find(a => a.mes === mes);
  if (existente) { existente.valor += valor; tocar(existente); }
  else dados.aportes.push(tocar({ id: novoId(), mes, valor, lancamentoId: lanc.id, criadoEm: Date.now() }));
  save();
}

function ultimosLancamentosHtml(dados) {
  const ult = [...dados.lancamentos].sort((a, b) => b.criadoEm - a.criadoEm).slice(0, 8);
  if (!ult.length) return '<div class="empty">Nada lançado ainda — comece acima! 👆</div>';
  return ult.map(l => {
    const c = dados.categorias.find(c => c.id === l.categoriaId);
    const cor = l.tipo === 'Receita' ? 'pos' : l.tipo === 'Investimento' ? '' : 'neg';
    const parc = l.parcelaTotal ? ` ${l.parcelaAtual}/${l.parcelaTotal}` : '';
    return `<div class="row" data-id="${l.id}">
      <span class="l"><span class="txt">${c?.icone || '📦'} ${esc(l.descricao)}${parc} <span class="muted small">· ${l.data.slice(8, 10)}/${l.data.slice(5, 7)}</span></span></span>
      <span class="r ${cor}">${l.tipo === 'Receita' ? '+' : '−'}${moeda(l.valor)} <button class="icon-btn btn-del" data-id="${l.id}" title="Excluir">🗑️</button></span>
    </div>`;
  }).join('');
}

/* ================= INVESTIMENTOS ================= */

function renderInvest() {
  const dados = db();
  const { config } = dados;
  const somaAportes = dados.aportes.reduce((s, a) => s + a.valor, 0);
  const total = (config.valorInicialInvestimento || 0) + somaAportes;
  const meta = config.metaTotal || 0;

  let mesesRestantes = 0;
  if (config.metaPrazo) {
    const [aM, mM] = config.metaPrazo.split('-').map(Number);
    const agora = new Date();
    mesesRestantes = Math.max((aM - agora.getFullYear()) * 12 + (mM - (agora.getMonth() + 1)), 0);
  }
  const sugestao = mesesRestantes > 0 ? Math.max((meta - total) / mesesRestantes, 0) : 0;
  const historico = [...dados.aportes].sort((a, b) => b.mes.localeCompare(a.mes));

  $('#view').innerHTML = `
    <div class="hero-grad verde">
      ${anelProgresso(total, meta)}
      <div class="label" style="margin-top:10px">Total investido</div>
      <div class="valor">${moeda(total)}</div>
      <div class="hero-pills">
        <span class="hero-pill">meta <b>${moeda(meta)}</b></span>
        <span class="hero-pill">faltam <b>${moeda(Math.max(meta - total, 0))}</b></span>
      </div>
    </div>

    <div class="grid2">
      <div class="stat"><span class="emoji">🏦</span><div class="k">Valor inicial</div><div class="v">${moeda(config.valorInicialInvestimento || 0)}</div></div>
      <div class="stat"><span class="emoji">📥</span><div class="k">Aportado depois</div><div class="v pos">${moeda(somaAportes)}</div></div>
    </div>

    ${sugestao > 0 ? `<div class="card"><div class="insight" style="padding:0;border:none"><span class="ico">🎯</span><span>Para bater a meta ${mesesRestantes ? `em ${mesesRestantes} meses` : 'no prazo'}, o aporte sugerido é <strong class="mono">${moeda(sugestao)}</strong>/mês.</span></div></div>` : ''}

    <div class="card">
      <h3>Aporte rápido</h3>
      <input class="valor-input" id="inpAporte" inputmode="decimal" placeholder="0,00">
      <div style="height:12px"></div>
      <button class="btn btn-green" id="btnAporte">💎 Lançar aporte</button>
    </div>

    <div class="card">
      <h3>Histórico de aportes</h3>
      ${historico.map(a => `<div class="row"><span class="l">${mesLabel(a.mes)}</span><span class="r pos">${moeda(a.valor)}</span></div>`).join('')
        || '<div class="empty">Nenhum aporte ainda.</div>'}
    </div>
  `;

  $('#btnAporte').addEventListener('click', () => {
    const v = valorBR($('#inpAporte').value);
    if (!(v > 0)) { toast('Informe o valor do aporte', true); return; }
    registrarAporte(db(), v, hojeISO());
    toast('Aporte registrado 💎');
    renderInvest();
  });
}

/* ================= HISTÓRICO ================= */

function mesesComDados(dados) {
  const set = new Set(dados.lancamentos.map(l => l.mesFatura));
  for (const meses of Object.values(dados.faturasFechadas || {})) for (const m of Object.keys(meses)) set.add(m);
  return [...set].sort((a, b) => b.localeCompare(a));
}

let mesSelecionado = null;

function renderHistorico() {
  const dados = db();
  const meses = mesesComDados(dados);
  const mesAtual = mesAtualKey();
  if (!mesSelecionado || !meses.includes(mesSelecionado)) {
    mesSelecionado = meses.includes(mesAtual) ? mesAtual : meses[0];
  }

  if (!meses.length) {
    $('#view').innerHTML = '<div class="card"><div class="empty">Ainda não há lançamentos.<br>Comece pela aba ✏️ Lançar!</div></div>';
    return;
  }

  const r = resumoMes(dados, mesSelecionado);
  const itensDonut = Object.entries(r.porCategoria)
    .map(([id, valor]) => {
      const c = dados.categorias.find(c => c.id === id);
      return { nome: c?.nome || 'Outros', cor: c?.cor || '#898781', icone: c?.icone || '📦', valor };
    })
    .sort((a, b) => b.valor - a.valor);
  let donutItens = itensDonut;
  if (itensDonut.length > 7) {
    const cabeca = itensDonut.slice(0, 6);
    const cauda = itensDonut.slice(6).reduce((s, i) => s + i.valor, 0);
    donutItens = [...cabeca, { nome: 'Outros', cor: '#898781', icone: '📦', valor: cauda }];
  }
  const totalDonut = itensDonut.reduce((s, i) => s + i.valor, 0);

  // barras: só até o mês atual (parcelas futuras aparecem nos cards abaixo)
  const mesesCrono = [...meses].sort((a, b) => a.localeCompare(b)).filter(m => m <= mesAtual);
  const barras = mesesCrono.map(m => ({ mes: m, valor: resumoMes(dados, m).gastoTotal }));

  const cardsMeses = meses.map(m => {
    const rm = resumoMes(dados, m);
    const saldo = (rm.receitaReal || rm.receita) - rm.gastoTotal;
    return `<div class="card mes-card">
      <div class="mes-title">${mesLabel(m)}${rm.fechado ? ' <span class="badge ok">🔒 fechado</span>' : ''}</div>
      <div class="hist-grid">
        <div class="hist-item receita"><div class="k">Receita</div><div class="v">${moeda(rm.receitaReal || rm.receita)}</div></div>
        <div class="hist-item gasto"><div class="k">Gasto total</div><div class="v">${moeda(rm.gastoTotal)}</div></div>
        <div class="hist-item cartao"><div class="k">Cartões</div><div class="v">${moeda(rm.totalCartoes)}</div></div>
        <div class="hist-item saldo"><div class="k">Saldo</div><div class="v">${moeda(saldo)}</div></div>
      </div>
      <details style="margin-top:10px"><summary class="small muted">ver lançamentos ▾</summary>
        <div style="margin-top:6px">${lancamentosDoMesHtml(dados, m)}</div>
      </details>
    </div>`;
  }).join('');

  $('#view').innerHTML = `
    <div class="card">
      <h3>Gasto por mês</h3>
      ${barrasMensais(barras, mesAtual)}
    </div>

    <div class="card">
      <h3>Para onde foi o dinheiro</h3>
      <div class="chips scroll" id="chipsMes" style="margin-bottom:4px">
        ${meses.map(m => `<button class="chip ${m === mesSelecionado ? 'active' : ''}" data-m="${m}">${mesLabel(m)}</button>`).join('')}
      </div>
      ${donut(donutItens, totalDonut)}
    </div>

    ${cardsMeses}
  `;

  $('#chipsMes').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    mesSelecionado = b.dataset.m;
    renderHistorico();
  });
}

function lancamentosDoMesHtml(dados, mes) {
  const ls = dados.lancamentos.filter(l => l.mesFatura === mes)
    .sort((a, b) => b.data.localeCompare(a.data));
  if (!ls.length) return '<div class="empty">Sem lançamentos.</div>';
  return ls.map(l => {
    const c = dados.categorias.find(c => c.id === l.categoriaId);
    const cor = l.tipo === 'Receita' ? 'pos' : l.tipo === 'Investimento' ? '' : 'neg';
    const parc = l.parcelaTotal ? ` ${l.parcelaAtual}/${l.parcelaTotal}` : '';
    return `<div class="row">
      <span class="l"><span class="txt">${c?.icone || '📦'} ${esc(l.descricao)}${parc} <span class="muted small">· ${l.data.slice(8, 10)}/${l.data.slice(5, 7)} · ${esc(l.pagamento)}</span></span></span>
      <span class="r ${cor}">${l.tipo === 'Receita' ? '+' : '−'}${moeda(l.valor)} <button class="icon-btn btn-del" data-id="${l.id}">🗑️</button></span>
    </div>`;
  }).join('');
}

/* ================= CONFIG ================= */

function renderConfig() {
  const dados = db();
  const { config } = dados;

  $('#view').innerHTML = `
    <div class="card">
      <h3>Casal</h3>
      <label class="f" style="margin-top:0">Nomes (aparece no topo)</label>
      <input id="cfgNomes" value="${esc(config.nomes)}" placeholder="Ex.: Tiago & Duda">
      <label class="f">Código do casal</label>
      <div class="codigo-view" style="margin:4px 0 8px">${esc(config.codigoCasal) || '— sem código —'}</div>
      <button class="btn btn-ghost" id="btnCopiarCodigo">📋 Copiar código</button>
      <p class="small muted" style="margin-top:10px">Quem entrar com esse código no outro celular vê e lança nas mesmas contas (requer a sincronização ativa abaixo).</p>
    </div>

    <div class="card">
      <h3>Sincronização <span class="badge ${syncAtivo() ? 'ok' : ''}">${syncAtivo() ? 'ativa' : 'desativada'}</span></h3>
      <p class="small muted" style="margin-bottom:4px">Crie um projeto gratuito no supabase.com, rode a migração <code>casais_sync</code> (está no repositório) e cole abaixo:</p>
      <label class="f">URL do projeto</label>
      <input id="cfgSyncUrl" placeholder="https://xxxx.supabase.co" value="${esc(config.syncUrl)}">
      <label class="f">Chave anon (public)</label>
      <input id="cfgSyncKey" type="password" placeholder="eyJ..." value="${esc(config.syncKey)}">
      <div style="height:12px"></div>
      <button class="btn btn-primary" id="btnSalvarSync">Salvar e sincronizar</button>
    </div>

    <div class="card">
      <h3>Metas</h3>
      <div class="form-row2">
        <div><label class="f" style="margin-top:0">Aporte mensal (R$)</label><input class="mono" id="cfgAporte" inputmode="decimal" value="${config.metaMensalAporte}"></div>
        <div><label class="f" style="margin-top:0">Meta total (R$)</label><input class="mono" id="cfgMetaTotal" inputmode="decimal" value="${config.metaTotal}"></div>
      </div>
      <div class="form-row2">
        <div><label class="f">Prazo da meta</label><input type="month" id="cfgPrazo" value="${config.metaPrazo}"></div>
        <div><label class="f">Já investido (inicial)</label><input class="mono" id="cfgInicial" inputmode="decimal" value="${config.valorInicialInvestimento}"></div>
      </div>
      <div style="height:12px"></div>
      <button class="btn btn-primary" id="btnSalvarMetas">Salvar metas</button>
    </div>

    <div class="card">
      <h3>Cartões <button class="btn btn-sm btn-ghost" id="btnAddCartao" style="box-shadow:none;background:#eef0fe;color:var(--indigo-dark)">+ novo</button></h3>
      <div>${dados.cartoes.map(c => `
        <div class="item-edit">
          <div style="min-width:0">
            <div class="t">💳 ${esc(c.nome)} ${c.ativo ? '' : '<span class="badge">inativo</span>'}</div>
            <div class="s">fecha dia ${c.diaFechamento} · vence dia ${c.diaVencimento}</div>
          </div>
          <div style="flex:none;display:flex;gap:6px">
            <button class="icon-btn btn-edit-cartao" data-id="${c.id}">✏️</button>
            <button class="icon-btn btn-toggle-cartao" data-id="${c.id}">${c.ativo ? '⏸️' : '▶️'}</button>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Despesas fixas <button class="btn btn-sm btn-ghost" id="btnAddFixa" style="box-shadow:none;background:#eef0fe;color:var(--indigo-dark)">+ nova</button></h3>
      <div>${dados.despesasFixas.map(f => {
        const c = dados.categorias.find(c => c.id === f.categoriaId);
        return `<div class="item-edit">
          <div style="min-width:0">
            <div class="t">${c?.icone || ''} ${esc(f.descricao)} ${f.ativa ? '' : '<span class="badge">inativa</span>'}</div>
            <div class="s">${moeda(f.valor)} · dia ${f.diaVencimento} · ${esc(f.pagamento || DINHEIRO_PIX)}</div>
          </div>
          <div style="flex:none;display:flex;gap:6px">
            <button class="icon-btn btn-edit-fixa" data-id="${f.id}">✏️</button>
            <button class="icon-btn btn-del-fixa" data-id="${f.id}">🗑️</button>
          </div>
        </div>`;
      }).join('') || '<div class="empty">Aluguel, internet, escola… cadastre aqui e elas entram sozinhas todo mês.</div>'}
      </div>
    </div>

    <div class="card">
      <h3>Categorias <button class="btn btn-sm btn-ghost" id="btnAddCat" style="box-shadow:none;background:#eef0fe;color:var(--indigo-dark)">+ nova</button></h3>
      <div>${dados.categorias.map(c => `
        <div class="item-edit">
          <div class="l" style="display:flex;align-items:center;gap:9px;min-width:0">
            <span class="dot" style="background:${c.cor}"></span>
            <div style="min-width:0">
              <div class="t">${c.icone} ${esc(c.nome)}</div>
              ${c.orcamentoMensal ? `<div class="s">orçamento ${moeda(c.orcamentoMensal)}/mês</div>` : ''}
            </div>
          </div>
          <button class="icon-btn btn-edit-cat" data-id="${c.id}" style="flex:none">✏️</button>
        </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>Assistente IA</h3>
      <p class="small muted" style="margin-bottom:8px">Cole sua chave da API Anthropic (console.anthropic.com) para habilitar a análise com IA no Painel. A chave fica salva apenas neste aparelho.</p>
      <input id="cfgApiKey" type="password" placeholder="sk-ant-..." value="${esc(config.apiKeyIA)}">
      <div style="height:10px"></div>
      <button class="btn btn-ghost" id="btnSalvarKey">Salvar chave</button>
    </div>

    <div class="card">
      <h3>Backup</h3>
      <button class="btn btn-ghost" id="btnExportar">⬇️ Exportar dados (JSON)</button>
      <div style="height:8px"></div>
      <button class="btn btn-ghost" id="btnImportar">⬆️ Importar backup</button>
      <input type="file" id="inpImportar" accept="application/json" style="display:none">
      <div style="height:8px"></div>
      <button class="btn btn-danger-ghost" id="btnReset">Apagar tudo e recomeçar</button>
    </div>

    <p class="small muted" style="text-align:center;margin:6px 0 20px">Finanças T&D v2</p>
  `;

  $('#btnCopiarCodigo').onclick = async () => {
    if (!config.codigoCasal) { toast('Sem código ainda', true); return; }
    try { await navigator.clipboard.writeText(config.codigoCasal); toast('Código copiado 📋'); }
    catch { toast(config.codigoCasal); }
  };

  $('#btnSalvarSync').onclick = async () => {
    const d = db();
    d.config.syncUrl = $('#cfgSyncUrl').value.trim();
    d.config.syncKey = $('#cfgSyncKey').value.trim();
    d.config.nomes = $('#cfgNomes').value.trim();
    if (!d.config.codigoCasal) d.config.codigoCasal = gerarCodigoCasal();
    tocar(d.config); save();
    if (syncAtivo()) {
      toast('Sincronizando…');
      const ok = await sincronizar(() => views[viewAtual]());
      toast(ok ? 'Sincronização ativa ✓' : 'Não foi possível conectar', !ok);
      iniciarSync(() => views[viewAtual]());
    } else {
      toast('Configuração salva');
    }
    renderConfig();
    atualizarTopbar();
  };

  $('#btnSalvarMetas').onclick = () => {
    const d = db();
    d.config.nomes = $('#cfgNomes').value.trim();
    d.config.metaMensalAporte = valorBR($('#cfgAporte').value);
    d.config.metaTotal = valorBR($('#cfgMetaTotal').value);
    d.config.metaPrazo = $('#cfgPrazo').value;
    d.config.valorInicialInvestimento = valorBR($('#cfgInicial').value);
    tocar(d.config); save(); toast('Metas salvas');
    atualizarTopbar();
  };

  $('#btnSalvarKey').onclick = () => {
    db().config.apiKeyIA = $('#cfgApiKey').value.trim();
    save(); toast('Chave salva neste aparelho');
  };

  $('#btnAddCartao').onclick = () => modalCartao(null);
  document.querySelectorAll('.btn-edit-cartao').forEach(b => b.onclick = () => modalCartao(b.dataset.id));
  document.querySelectorAll('.btn-toggle-cartao').forEach(b => b.onclick = () => {
    const c = db().cartoes.find(c => c.id === b.dataset.id);
    c.ativo = !c.ativo; tocar(c); save(); renderConfig();
  });

  $('#btnAddFixa').onclick = () => modalFixa(null);
  document.querySelectorAll('.btn-edit-fixa').forEach(b => b.onclick = () => modalFixa(b.dataset.id));
  document.querySelectorAll('.btn-del-fixa').forEach(b => b.onclick = () => {
    const d = db();
    marcarExcluido(b.dataset.id);
    d.despesasFixas = d.despesasFixas.filter(f => f.id !== b.dataset.id);
    save(); renderConfig(); toast('Despesa fixa removida');
  });

  $('#btnAddCat').onclick = () => modalCategoria(null);
  document.querySelectorAll('.btn-edit-cat').forEach(b => b.onclick = () => modalCategoria(b.dataset.id));

  $('#btnExportar').onclick = () => {
    const blob = new Blob([exportarJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `financas-td-${hojeISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#btnImportar').onclick = () => $('#inpImportar').click();
  $('#inpImportar').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { importarJSON(await f.text()); toast('Backup importado ✓'); navegar('painel'); }
    catch { toast('Arquivo de backup inválido', true); }
  };
  $('#btnReset').onclick = () => {
    modal(`<h2>Apagar tudo?</h2><p class="small muted">Todos os lançamentos, cartões e configurações deste aparelho serão apagados. Essa ação não pode ser desfeita.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="mCancelar">Cancelar</button>
        <button class="btn btn-danger-ghost" id="mConfirmar">Apagar tudo</button>
      </div>`, m => {
      m.querySelector('#mCancelar').onclick = fecharModal;
      m.querySelector('#mConfirmar').onclick = () => { resetarTudo(); fecharModal(); location.reload(); };
    });
  };
}

function modalCartao(id) {
  const d = db();
  const c = id ? d.cartoes.find(c => c.id === id) : { nome: '', diaFechamento: 25, diaVencimento: 3, ativo: true };
  modal(`
    <h2>${id ? 'Editar' : 'Novo'} cartão</h2>
    <label class="f">Nome</label><input id="mNome" value="${esc(c.nome)}" placeholder="Ex.: Nubank Tiago">
    <div class="form-row2">
      <div><label class="f">Dia de fechamento</label><input type="number" id="mFech" min="1" max="31" value="${c.diaFechamento}"></div>
      <div><label class="f">Dia de vencimento</label><input type="number" id="mVenc" min="1" max="31" value="${c.diaVencimento}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="mCancelar">Cancelar</button>
      <button class="btn btn-primary" id="mSalvar">Salvar</button>
    </div>`, m => {
    m.querySelector('#mCancelar').onclick = fecharModal;
    m.querySelector('#mSalvar').onclick = () => {
      const nome = m.querySelector('#mNome').value.trim();
      if (!nome) { toast('Dê um nome ao cartão', true); return; }
      const fech = Math.min(Math.max(Number(m.querySelector('#mFech').value) || 25, 1), 31);
      const venc = Math.min(Math.max(Number(m.querySelector('#mVenc').value) || 3, 1), 31);
      if (id) tocar(Object.assign(c, { nome, diaFechamento: fech, diaVencimento: venc }));
      else d.cartoes.push(tocar({ id: novoId(), nome, diaFechamento: fech, diaVencimento: venc, ativo: true }));
      save(); fecharModal(); renderConfig(); toast('Cartão salvo');
    };
  });
}

function modalFixa(id) {
  const d = db();
  const f = id ? d.despesasFixas.find(f => f.id === id)
    : { descricao: '', valor: 0, categoriaId: d.categorias[0]?.id, pagamento: DINHEIRO_PIX, diaVencimento: 5, ativa: true };
  const pagamentos = [...d.cartoes.filter(c => c.ativo).map(c => c.nome), DINHEIRO_PIX];
  modal(`
    <h2>${id ? 'Editar' : 'Nova'} despesa fixa</h2>
    <label class="f">Descrição</label><input id="mDesc" value="${esc(f.descricao)}" placeholder="Ex.: Aluguel">
    <div class="form-row2">
      <div><label class="f">Valor (R$)</label><input class="mono" id="mValor" inputmode="decimal" value="${f.valor || ''}"></div>
      <div><label class="f">Dia</label><input type="number" id="mDia" min="1" max="31" value="${f.diaVencimento}"></div>
    </div>
    <label class="f">Categoria</label>
    <select id="mCat">${d.categorias.map(c => `<option value="${c.id}" ${c.id === f.categoriaId ? 'selected' : ''}>${c.icone} ${esc(c.nome)}</option>`).join('')}</select>
    <label class="f">Pagamento</label>
    <select id="mPag">${pagamentos.map(p => `<option ${p === f.pagamento ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
    <label class="f"><input type="checkbox" id="mAtiva" ${f.ativa ? 'checked' : ''} style="width:auto;margin-right:6px">Ativa</label>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="mCancelar">Cancelar</button>
      <button class="btn btn-primary" id="mSalvar">Salvar</button>
    </div>`, m => {
    m.querySelector('#mCancelar').onclick = fecharModal;
    m.querySelector('#mSalvar').onclick = () => {
      const desc = m.querySelector('#mDesc').value.trim();
      const valor = valorBR(m.querySelector('#mValor').value);
      if (!desc || !(valor > 0)) { toast('Preencha descrição e valor', true); return; }
      const novo = {
        descricao: desc, valor,
        categoriaId: m.querySelector('#mCat').value,
        pagamento: m.querySelector('#mPag').value,
        diaVencimento: Math.min(Math.max(Number(m.querySelector('#mDia').value) || 5, 1), 31),
        ativa: m.querySelector('#mAtiva').checked,
      };
      if (id) tocar(Object.assign(f, novo));
      else d.despesasFixas.push(tocar({ id: novoId(), ...novo }));
      save(); fecharModal(); renderConfig(); toast('Despesa fixa salva');
    };
  });
}

function modalCategoria(id) {
  const d = db();
  const c = id ? d.categorias.find(c => c.id === id)
    : { nome: '', cor: '#5b6ef5', icone: '📦', orcamentoMensal: null };
  modal(`
    <h2>${id ? 'Editar' : 'Nova'} categoria</h2>
    <div class="form-row2">
      <div><label class="f">Nome</label><input id="mNome" value="${esc(c.nome)}"></div>
      <div><label class="f">Emoji</label><input id="mIcone" value="${esc(c.icone)}" maxlength="4"></div>
    </div>
    <div class="form-row2">
      <div><label class="f">Cor</label><input type="color" id="mCor" value="${c.cor}" style="height:48px;padding:5px"></div>
      <div><label class="f">Orçamento/mês (opcional)</label><input class="mono" id="mOrc" inputmode="decimal" value="${c.orcamentoMensal ?? ''}"></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="mCancelar">Cancelar</button>
      <button class="btn btn-primary" id="mSalvar">Salvar</button>
    </div>`, m => {
    m.querySelector('#mCancelar').onclick = fecharModal;
    m.querySelector('#mSalvar').onclick = () => {
      const nome = m.querySelector('#mNome').value.trim();
      if (!nome) { toast('Dê um nome à categoria', true); return; }
      const orc = valorBR(m.querySelector('#mOrc').value);
      const novo = { nome, icone: m.querySelector('#mIcone').value || '📦', cor: m.querySelector('#mCor').value, orcamentoMensal: orc > 0 ? orc : null };
      if (id) tocar(Object.assign(c, novo));
      else d.categorias.push(tocar({ id: novoId(), ...novo }));
      save(); fecharModal(); renderConfig(); toast('Categoria salva');
    };
  });
}

/* ================= ONBOARDING ================= */

function renderOnboarding(passo = 'boasvindas') {
  let el = $('#onboardRoot');
  if (!el) {
    el = document.createElement('div');
    el.id = 'onboardRoot';
    document.body.appendChild(el);
  }

  const telas = {
    boasvindas: `
      <div class="onboard">
        <div class="onboard-logo">💰</div>
        <h1>Finanças T&D</h1>
        <p class="tagline">Finanças a dois, sem complicação.<br>Rápido de lançar, bonito de acompanhar.</p>
        <div class="onboard-card">
          <button class="btn btn-primary" data-passo="nomes">Criar nossa conta</button>
          <button class="link-btn" data-passo="entrar">Já tenho um código do casal</button>
        </div>
      </div>`,
    nomes: `
      <div class="onboard">
        <div class="onboard-logo">👋</div>
        <div class="onboard-card">
          <h2>Como vocês se chamam?</h2>
          <p class="sub">Aparece no topo do app.</p>
          <input id="obNomes" placeholder="Ex.: Tiago & Duda" autocomplete="off">
          <div style="height:14px"></div>
          <button class="btn btn-primary" id="obCriar">Continuar</button>
        </div>
        <button class="link-claro" data-passo="boasvindas">← voltar</button>
      </div>`,
    codigo: `
      <div class="onboard">
        <div class="onboard-logo">🔑</div>
        <div class="onboard-card">
          <h2>Este é o código do casal</h2>
          <p class="sub">Guarde com carinho: é com ele que o outro celular entra nas mesmas contas.</p>
          <div class="codigo-view">${esc(db().config.codigoCasal)}</div>
          <button class="btn btn-ghost" id="obCopiar" style="box-shadow:none;background:#f4f3f9">📋 Copiar</button>
          <div style="height:10px"></div>
          <button class="btn btn-primary" id="obConcluir">Começar a usar 🚀</button>
        </div>
      </div>`,
    entrar: `
      <div class="onboard">
        <div class="onboard-logo">🔑</div>
        <div class="onboard-card">
          <h2>Entrar com código</h2>
          <p class="sub">Digite o código criado no outro celular. Para puxar os dados automaticamente, preencha também a sincronização (ou faça depois em Config).</p>
          <label class="f">Código do casal</label>
          <input id="obCodigo" placeholder="XXXX-XXXX-XXXX" autocomplete="off" style="text-transform:uppercase" class="mono">
          <label class="f">URL do Supabase <span class="muted" style="font-weight:500">(opcional)</span></label>
          <input id="obUrl" placeholder="https://xxxx.supabase.co">
          <label class="f">Chave anon <span class="muted" style="font-weight:500">(opcional)</span></label>
          <input id="obKey" type="password" placeholder="eyJ...">
          <div style="height:14px"></div>
          <button class="btn btn-primary" id="obEntrar">Entrar</button>
        </div>
        <button class="link-claro" data-passo="boasvindas">← voltar</button>
      </div>`,
  };

  el.innerHTML = telas[passo];

  el.querySelectorAll('[data-passo]').forEach(b => b.onclick = () => renderOnboarding(b.dataset.passo));

  if (passo === 'nomes') {
    el.querySelector('#obCriar').onclick = () => {
      const d = db();
      d.config.nomes = el.querySelector('#obNomes').value.trim();
      if (!d.config.codigoCasal) d.config.codigoCasal = gerarCodigoCasal();
      tocar(d.config); save();
      renderOnboarding('codigo');
    };
    el.querySelector('#obNomes').focus();
  }

  if (passo === 'codigo') {
    el.querySelector('#obCopiar').onclick = async () => {
      try { await navigator.clipboard.writeText(db().config.codigoCasal); toast('Código copiado 📋'); } catch {}
    };
    el.querySelector('#obConcluir').onclick = concluirOnboarding;
  }

  if (passo === 'entrar') {
    el.querySelector('#obEntrar').onclick = async () => {
      const codigo = el.querySelector('#obCodigo').value.trim().toUpperCase();
      const url = el.querySelector('#obUrl').value.trim();
      const key = el.querySelector('#obKey').value.trim();
      if (!codigo) { toast('Digite o código', true); return; }
      const d = db();
      d.config.codigoCasal = codigo;
      d.config.syncUrl = url;
      d.config.syncKey = key;
      tocar(d.config); save();
      if (url && key) {
        const btn = el.querySelector('#obEntrar');
        btn.disabled = true; btn.innerHTML = '<span class="spinner" style="border-color:rgba(255,255,255,.4);border-top-color:#fff"></span>';
        try {
          const remoto = await entrarComCodigo(d.config, codigo);
          if (remoto) {
            substituir(mesclar(db(), remoto));
            toast('Dados do casal carregados 💜');
          } else {
            toast('Código ainda sem dados na nuvem — tudo pronto para começar');
          }
        } catch (e) {
          toast(e.message, true);
          btn.disabled = false; btn.textContent = 'Entrar';
          return;
        }
      }
      concluirOnboarding();
    };
  }
}

function concluirOnboarding() {
  const d = db();
  d.config.onboarded = true;
  save();
  $('#onboardRoot')?.remove();
  atualizarTopbar();
  iniciarSync(() => views[viewAtual]());
  navegar('painel');
}

/* ================= navegação / boot ================= */

const views = { painel: renderPainel, lancar: renderLancar, invest: renderInvest, historico: renderHistorico, config: renderConfig };

function navegar(nome) {
  viewAtual = nome;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === nome));
  views[nome]();
  window.scrollTo(0, 0);
}

$('#bottomnav').addEventListener('click', e => {
  const b = e.target.closest('.nav-btn');
  if (b) navegar(b.dataset.view);
});

document.addEventListener('click', e => {
  const b = e.target.closest('.btn-del');
  if (!b) return;
  e.stopPropagation();
  const d = db();
  const l = d.lancamentos.find(l => l.id === b.dataset.id);
  if (!l) return;
  modal(`<h2>Excluir lançamento?</h2>
    <p class="small muted">${esc(l.descricao)} · ${moeda(l.valor)}${l.grupoParcelamento ? '<br><br>Este item faz parte de um parcelamento — todas as parcelas serão excluídas.' : ''}</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="mCancelar">Cancelar</button>
      <button class="btn btn-danger-ghost" id="mConfirmar">Excluir</button>
    </div>`, m => {
    m.querySelector('#mCancelar').onclick = fecharModal;
    m.querySelector('#mConfirmar').onclick = () => {
      if (l.grupoParcelamento) {
        for (const x of d.lancamentos.filter(x => x.grupoParcelamento === l.grupoParcelamento)) marcarExcluido(x.id);
        d.lancamentos = d.lancamentos.filter(x => x.grupoParcelamento !== l.grupoParcelamento);
      } else {
        marcarExcluido(l.id);
        d.lancamentos = d.lancamentos.filter(x => x.id !== l.id);
        if (l.tipo === 'Investimento') {
          const ap = d.aportes.find(a => a.mes === l.mesFatura);
          if (ap) {
            ap.valor -= l.valor; tocar(ap);
            if (ap.valor <= 0) { marcarExcluido(ap.id); d.aportes = d.aportes.filter(a => a !== ap); }
          }
        }
      }
      save(); fecharModal(); toast('Excluído');
      views[viewAtual]();
    };
  });
});

function atualizarTopbar() {
  const { config } = db();
  $('#brandName').childNodes[0].textContent = config.nomes ? `Olá, ${config.nomes}` : 'Finanças T&D';
  $('#brandSub').textContent = config.nomes ? 'Finanças T&D' : '';
  $('#topbarMonth').textContent = mesLabel(mesAtualKey());
}

onSyncStatus(s => {
  const dot = $('#syncDot');
  if (!dot) return;
  dot.className = 'sync-dot ' + s;
});

// push automático (debounce) sempre que algo é salvo
onSave(() => agendarPush());

const dados = db();
atualizarTopbar();
gerarFixasDoMes();

if (!dados.config.onboarded) {
  renderOnboarding('boasvindas');
} else {
  iniciarSync(() => views[viewAtual]());
}
navegar('painel');
