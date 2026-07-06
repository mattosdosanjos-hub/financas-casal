// Testes da lógica crítica de mês-fatura e utilitários de data.
// Rodar com: node tests/calc.test.mjs

import { calcularMesFatura, addMeses, addMesesData, mesLabel } from '../js/calc.js';

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

console.log(`\n${ok} testes passaram, ${falhas} falharam.`);
process.exit(falhas ? 1 : 0);
