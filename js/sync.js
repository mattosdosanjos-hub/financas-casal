// Sincronização por código do casal — Supabase (REST, sem SDK).
// Modelo: uma linha por código na tabela `casais_sync` com o estado completo.
// A mesclagem é por item (timestamp `m` decide) + tombstones em `excluidos`,
// então dois celulares podem lançar ao mesmo tempo sem se atropelar.

import { db, substituir, save } from './store.js';

let timerPush = null;
let timerPoll = null;
let sincronizando = false;
let listeners = [];

export function onSyncStatus(fn) { listeners.push(fn); }
function status(s) { for (const fn of listeners) fn(s); }

export function syncAtivo() {
  const { config } = db();
  return !!(config.syncUrl && config.syncKey && config.codigoCasal);
}

function headers(config) {
  return {
    'content-type': 'application/json',
    apikey: config.syncKey,
    authorization: `Bearer ${config.syncKey}`,
  };
}

function endpoint(config) {
  return `${config.syncUrl.replace(/\/$/, '')}/rest/v1/casais_sync`;
}

async function baixar(config) {
  const r = await fetch(`${endpoint(config)}?codigo=eq.${encodeURIComponent(config.codigoCasal)}&select=dados`, {
    headers: headers(config),
  });
  if (!r.ok) throw new Error(`Sync: erro ${r.status} ao baixar`);
  const rows = await r.json();
  return rows[0]?.dados ?? null;
}

async function subir(config, dados) {
  const r = await fetch(`${endpoint(config)}?on_conflict=codigo`, {
    method: 'POST',
    headers: { ...headers(config), prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ codigo: config.codigoCasal, dados, atualizado_em: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`Sync: erro ${r.status} ao enviar`);
}

// ---------- mesclagem ----------

function mesclarColecao(a = [], b = [], excluidos) {
  const porId = new Map();
  for (const it of [...a, ...b]) {
    const atual = porId.get(it.id);
    if (!atual || (it.m ?? 0) > (atual.m ?? 0)) porId.set(it.id, it);
  }
  return [...porId.values()].filter(it => !excluidos[it.id]);
}

function mesclarPorChave(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!out[k] || (v.m ?? 0) >= (out[k].m ?? 0)) out[k] = v;
  }
  return out;
}

export function mesclar(local, remoto) {
  if (!remoto) return local;
  const excluidos = { ...(local.excluidos || {}), ...(remoto.excluidos || {}) };
  const config = (remoto.config?.m ?? 0) > (local.config?.m ?? 0)
    ? { ...local.config, ...remoto.config }
    : { ...remoto.config, ...local.config };
  // credenciais e onboarding são sempre do aparelho local
  config.syncUrl = local.config.syncUrl;
  config.syncKey = local.config.syncKey;
  config.apiKeyIA = local.config.apiKeyIA;
  config.onboarded = local.config.onboarded;
  config.codigoCasal = local.config.codigoCasal;

  const faturas = { ...(remoto.faturasFechadas || {}) };
  for (const [cartaoId, meses] of Object.entries(local.faturasFechadas || {})) {
    faturas[cartaoId] = mesclarPorChave(faturas[cartaoId], meses);
  }

  return {
    versao: 2,
    config,
    cartoes: mesclarColecao(local.cartoes, remoto.cartoes, excluidos),
    categorias: mesclarColecao(local.categorias, remoto.categorias, excluidos),
    despesasFixas: mesclarColecao(local.despesasFixas, remoto.despesasFixas, excluidos),
    lancamentos: mesclarColecao(local.lancamentos, remoto.lancamentos, excluidos),
    aportes: mesclarColecao(local.aportes, remoto.aportes, excluidos),
    registrosFatura: mesclarColecao(local.registrosFatura, remoto.registrosFatura, excluidos),
    projecoes: mesclarPorChave(local.projecoes, remoto.projecoes),
    faturasFechadas: faturas,
    fixasGeradas: { ...(remoto.fixasGeradas || {}), ...(local.fixasGeradas || {}) },
    excluidos,
  };
}

// ---------- ciclo de sincronização ----------

export async function sincronizar(renderizar) {
  if (!syncAtivo() || sincronizando) return false;
  sincronizando = true;
  status('sync');
  try {
    const local = db();
    const remoto = await baixar(local.config);
    const mesclado = mesclar(local, remoto);
    const antes = JSON.stringify({ l: local.lancamentos.length, a: local.aportes.length });
    substituir(mesclado);
    await subir(mesclado.config, limparParaEnvio(mesclado));
    status('ok');
    const depois = JSON.stringify({ l: mesclado.lancamentos.length, a: mesclado.aportes.length });
    if (renderizar && antes !== depois) renderizar();
    return true;
  } catch (e) {
    console.warn(e);
    status('erro');
    return false;
  } finally {
    sincronizando = false;
  }
}

// nunca envia segredos do aparelho para a nuvem
function limparParaEnvio(d) {
  const copia = JSON.parse(JSON.stringify(d));
  copia.config.apiKeyIA = '';
  copia.config.syncUrl = '';
  copia.config.syncKey = '';
  copia.config.onboarded = false;
  return copia;
}

export function agendarPush() {
  if (!syncAtivo()) return;
  clearTimeout(timerPush);
  timerPush = setTimeout(() => sincronizar(), 1500);
}

export function iniciarSync(renderizar) {
  if (!syncAtivo()) return;
  sincronizar(renderizar);
  clearInterval(timerPoll);
  timerPoll = setInterval(() => sincronizar(renderizar), 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sincronizar(renderizar);
  });
}

// Testa credenciais + baixa dados de um código existente (para o onboarding "Tenho um código").
export async function entrarComCodigo(config, codigo) {
  const r = await fetch(`${endpoint(config)}?codigo=eq.${encodeURIComponent(codigo)}&select=dados`, {
    headers: headers(config),
  });
  if (!r.ok) throw new Error(`Não foi possível conectar (erro ${r.status}). Confira a URL e a chave.`);
  const rows = await r.json();
  return rows[0]?.dados ?? null;
}
