-- ═══════════════════════════════════════════════════════════
-- Incremento atômico de aportes_investimento
--
-- lancarAporte() no Lovable somava o valor do mês fazendo
-- read -> soma no client -> upsert, o que perde dados se os
-- dois membros do casal lançarem um aporte quase ao mesmo
-- tempo (lost update). Move a soma para dentro do Postgres via
-- INSERT ... ON CONFLICT DO UPDATE, que é atômico.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION incrementar_aporte(
  p_casal_id UUID,
  p_mes TEXT,
  p_valor NUMERIC,
  p_lancamento_id UUID
)
RETURNS aportes_investimento
LANGUAGE sql
AS $$
  INSERT INTO aportes_investimento (casal_id, mes, valor, lancamento_id)
  VALUES (p_casal_id, p_mes, p_valor, p_lancamento_id)
  ON CONFLICT (casal_id, mes)
  DO UPDATE SET valor = aportes_investimento.valor + excluded.valor,
                lancamento_id = excluded.lancamento_id
  RETURNING *;
$$;
