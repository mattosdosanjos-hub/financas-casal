// Camada de dados — localStorage com estrutura versionada (v2).
// Cada item carrega `m` (timestamp de modificação) e exclusões viram
// tombstones em `excluidos` — é isso que permite a sincronização por
// código do casal (js/sync.js) mesclar dois aparelhos sem perder nada.

const KEY = 'ftd_v1'; // mantém a chave para preservar dados já existentes

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const agora = () => Date.now();

const CATEGORIAS_PADRAO = [
  { nome: 'Mercado',      cor: '#5b6ef5', icone: '🛒' },
  { nome: 'Delivery',     cor: '#eda100', icone: '🍔' },
  { nome: 'Transporte',   cor: '#1fa97c', icone: '🚗' },
  { nome: 'Casa',         cor: '#ef5757', icone: '🏠' },
  { nome: 'Saúde',        cor: '#2a9db8', icone: '💊' },
  { nome: 'Lazer',        cor: '#eb6834', icone: '🎉' },
  { nome: 'Pessoal',      cor: '#8a5cd6', icone: '🛍️' },
  { nome: 'Assinaturas',  cor: '#e87ba4', icone: '📺' },
  { nome: 'Educação',     cor: '#4356d6', icone: '📚' },
  { nome: 'Investimento', cor: '#0d7d59', icone: '💎' },
  { nome: 'Receita',      cor: '#1fa97c', icone: '💰' },
  { nome: 'Outros',       cor: '#898781', icone: '📦' },
];

const CARTOES_PADRAO = [
  { nome: 'Nubank Tiago', diaFechamento: 28, diaVencimento: 5, ativo: true },
  { nome: 'C6 Tiago',     diaFechamento: 25, diaVencimento: 3, ativo: true },
  { nome: 'Sicoob Tiago', diaFechamento: 26, diaVencimento: 5, ativo: true },
  { nome: 'BRB Maria',    diaFechamento: 24, diaVencimento: 1, ativo: true },
];

function seed() {
  return migrar({
    versao: 2,
    config: {},
    cartoes: CARTOES_PADRAO.map(c => ({ id: uid(), m: agora(), ...c })),
    categorias: CATEGORIAS_PADRAO.map(c => ({ id: uid(), m: agora(), orcamentoMensal: null, ...c })),
    despesasFixas: [],
    lancamentos: [],
    aportes: [],
    projecoes: {},
    fixasGeradas: {},
  });
}

// Garante que dados antigos (v1) e backups ganhem os campos novos.
export function migrar(d) {
  d.versao = 2;
  d.config = Object.assign({
    nomeCasal: 'Finanças T&D',
    nomes: '',
    metaMensalAporte: 2000,
    metaTotal: 100000,
    metaPrazo: '2028-12',
    valorInicialInvestimento: 0,
    apiKeyIA: '',
    codigoCasal: '',
    onboarded: false,
    syncUrl: '',
    syncKey: '',
    m: 0,
  }, d.config || {});
  d.cartoes ??= [];
  d.categorias ??= [];
  d.despesasFixas ??= [];
  d.lancamentos ??= [];
  d.aportes ??= [];
  d.projecoes ??= {};
  d.fixasGeradas ??= {};
  d.registrosFatura ??= [];   // [{id, cartaoId, ciclo:'YYYY-MM', data, valor, m}]
  d.faturasFechadas ??= {};   // { cartaoId: { 'YYYY-MM': {valor, fechadaEm, m} } }
  d.excluidos ??= {};         // { id: timestamp } — tombstones para sync
  for (const col of [d.cartoes, d.categorias, d.despesasFixas, d.lancamentos, d.aportes, d.registrosFatura]) {
    for (const it of col) { it.m ??= 0; it.id ??= uid(); }
  }
  return d;
}

let cache = null;

export function db() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? migrar(JSON.parse(raw)) : seed();
  } catch { cache = seed(); }
  if (!localStorage.getItem(KEY)) persistir();
  return cache;
}

function persistir() {
  localStorage.setItem(KEY, JSON.stringify(cache));
}

let aoSalvar = null;
export function onSave(fn) { aoSalvar = fn; }

export function save() {
  persistir();
  if (aoSalvar) aoSalvar();
}

export function novoId() { return uid(); }
export function tocar(obj) { obj.m = agora(); return obj; }

// registra exclusão como tombstone (necessário para o sync não "ressuscitar" itens)
export function marcarExcluido(id) { cache.excluidos[id] = agora(); }

export function substituir(dados) {
  cache = migrar(dados);
  persistir();
}

export function exportarJSON() {
  return JSON.stringify(db(), null, 2);
}

export function importarJSON(texto) {
  const dados = JSON.parse(texto);
  if (!dados || !Array.isArray(dados.lancamentos)) throw new Error('Arquivo inválido');
  cache = migrar(dados);
  save();
}

export function resetarTudo() {
  cache = seed();
  save();
}

export function gerarCodigoCasal() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I/L
  const bloco = n => Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
  return `${bloco(4)}-${bloco(4)}-${bloco(4)}`;
}
