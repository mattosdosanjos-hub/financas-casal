// Testes da lógica crítica de mês-fatura e utilitários de data.
// Rodar com: node tests/calc.test.mjs

import { calcularMesFatura, addMeses, addMesesData, mesLabel, cicloAberto, ultimoCicloFechado, gastoCartoesEfetivo } from '../js/calc.js';

let ok = 0, falhas = 0;
function eq(desc, atual, esperado) {
  if (atual === esperado) { ok++; }
  else { falhas++; console.error(`✗ ${desc}: esperado ${esperado}, obtido ${atual}`); }
}

const cartoes = [{ nome: 'Nubank Tiago', diaFechamento: 28 }, { nome: 'C6 Tiago', diaFechamento: 25 }];

// compra antes do fechamento → mesmo mês
eq('antes do fechamento', calcularMesFatura('2026-07-10', 'Nubank Tiago', cartoes), '2026-07');
// no dia do fechamento → mesmo mês
eq('no dia do fechamento', calcularMesFatura('2026-07-28', 'Nubank Tiago', cartoes), '2026-07');
// depois do fechamento → mês seguinte
eq('depois do fechamento', calcularMesFatura('2026-07-29', 'Nubank Tiago', cartoes), '2026-08');
// virada de ano: dezembro depois do fechamento → janeiro do ano seguinte
eq('virada de ano', calcularMesFatura('2026-12-27', 'C6 Tiago', cartoes), '2027-01');
// Dinheiro/Pix sempre no mês da data, mesmo no fim do mês
eq('dinheiro/pix fim de mês', calcularMesFatura('2026-07-31', 'Dinheiro/Pix', cartoes), '2026-07');

// addMeses
eq('addMeses simples', addMeses('2026-07', 1), '2026-08');
eq('addMeses virada', addMeses('2026-12', 1), '2027-01');
eq('addMeses negativo', addMeses('2026-01', -1), '2025-12');
eq('addMeses +12', addMeses('2026-03', 12), '2027-03');

// addMesesData: 31/jan + 1 mês → 28/fev (clamp de dia)
eq('clamp fim de mês', addMesesData('2026-01-31', 1), '2026-02-28');
eq('parcela normal', addMesesData('2026-07-15', 2), '2026-09-15');

// label
eq('label', mesLabel('2026-07'), 'Jul/2026');
eq('label jan', mesLabel('2027-01'), 'Jan/2027');

// ciclos de fatura
const nub = { id: 'c1', nome: 'Nubank Tiago', diaFechamento: 28, ativo: true };
eq('ciclo aberto antes do fechamento', cicloAberto(nub, new Date(2026, 6, 10)), '2026-07');
eq('ciclo aberto após fechamento', cicloAberto(nub, new Date(2026, 6, 30)), '2026-08');
eq('ciclo aberto virada de ano', cicloAberto(nub, new Date(2026, 11, 30)), '2027-01');
eq('último ciclo fechado', ultimoCicloFechado(nub, new Date(2026, 6, 30)), '2026-07');

// gasto efetivo do cartão: max(lançado, fatura informada − fixas do cartão)
const dadosEf = {
  cartoes: [nub],
  despesasFixas: [{ id: 'f1', descricao: 'Streaming', valor: 50, pagamento: 'Nubank Tiago', ativa: true }],
  lancamentos: [
    { id: 'l1', tipo: 'Gasto', pagamento: 'Nubank Tiago', mesFatura: '2026-07', valor: 300 },
    { id: 'l2', tipo: 'Gasto', pagamento: 'Nubank Tiago', mesFatura: '2026-07', valor: 100, fixaId: 'f1' },
  ],
  registrosFatura: [{ id: 'r1', cartaoId: 'c1', ciclo: '2026-07', data: '2026-07-05', valor: 500, m: 2 }],
  faturasFechadas: {},
};
const ef = gastoCartoesEfetivo(dadosEf, '2026-07');
// fatura 500 − fixas 50 = 450 > lançado 300 → efetivo 450
eq('efetivo usa fatura informada', ef.porCartao['Nubank Tiago'].efetivo, 450);
eq('lançado exclui fixas', ef.porCartao['Nubank Tiago'].lancado, 300);
// fatura fechada tem prioridade sobre a informada
dadosEf.faturasFechadas = { c1: { '2026-07': { valor: 800, m: 3 } } };
eq('fatura fechada prevalece', gastoCartoesEfetivo(dadosEf, '2026-07').porCartao['Nubank Tiago'].efetivo, 750);

console.log(`\n${ok} testes passaram, ${falhas} falharam.`);
process.exit(falhas ? 1 : 0);
