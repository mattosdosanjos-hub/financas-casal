// Camada de dados — localStorage com estrutura versionada.
// Desenhada para que um adaptador Supabase possa substituí-la depois
// sem mudar as telas (mesma forma de dados do schema em supabase/migrations).

const KEY = 'ftd_v1';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

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
  { nome: 'Nubank Tiago', banco: 'Nubank', titular: 'Tiago', diaFechamento: 28, diaVencimento: 5, ativo: true },
  { nome: 'C6 Tiago',     banco: 'C6',     titular: 'Tiago', diaFechamento: 25, diaVencimento: 3, ativo: true },
  { nome: 'Sicoob Tiago', banco: 'Sicoob', titular: 'Tiago', diaFechamento: 26, diaVencimento: 5, ativo: true },
  { nome: 'BRB Maria',    banco: 'BRB',    titular: 'Maria', diaFechamento: 24, diaVencimento: 1, ativo: true },
];

function seed() {
  return {
    versao: 1,
    config: {
      nomeCasal: 'Finanças T&D',
      metaMensalAporte: 2000,
      metaTotal: 100000,
      metaPrazo: '2028-12',          // YYYY-MM
      valorInicialInvestimento: 0,
      apiKeyIA: '',
    },
    cartoes: CARTOES_PADRAO.map(c => ({ id: uid(), ...c })),
    categorias: CATEGORIAS_PADRAO.map(c => ({ id: uid(), orcamentoMensal: null, ...c })),
    despesasFixas: [],
    lancamentos: [],
    aportes: [],
    projecoes: {},   // { 'YYYY-MM': { valorProjetado, valorRealizado, fechadoEm } }
    fixasGeradas: {}, // { 'YYYY-MM': true }
  };
}

let cache = null;

export function db() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : seed();
  } catch { cache = seed(); }
  if (!localStorage.getItem(KEY)) save();
  return cache;
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(cache));
}

export function novoId() { return uid(); }

export function exportarJSON() {
  return JSON.stringify(db(), null, 2);
}

export function importarJSON(texto) {
  const dados = JSON.parse(texto);
  if (!dados || !Array.isArray(dados.lancamentos)) throw new Error('Arquivo inválido');
  cache = dados;
  save();
}

export function resetarTudo() {
  cache = seed();
  save();
}
