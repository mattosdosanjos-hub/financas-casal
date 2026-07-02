-- ═══════════════════════════════════════════════════════════
-- Finanças T&D — dados iniciais
-- Roda depois do schema. Não insere `membros`: isso só existe
-- depois que Tiago e Duda fizerem o primeiro login (ver
-- docs/prompts-lovable.md, etapa de Setup/Auth).
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  v_casal_id UUID;
  v_cat_alimentacao UUID;
  v_cat_moradia UUID;
  v_cat_transporte UUID;
  v_cat_saude_esporte UUID;
  v_cat_lazer UUID;
  v_cat_servicos UUID;
  v_cat_educacao_trabalho UUID;
BEGIN
  INSERT INTO casal (nome, meta_total, meta_mensal_aporte, valor_inicial_investimento, meta_prazo)
  VALUES ('T & D', 100000, 3000, 75000, '2026-12-31')
  RETURNING id INTO v_casal_id;

  INSERT INTO cartoes (casal_id, nome, banco, titular, dia_fechamento, dia_vencimento) VALUES
    (v_casal_id, 'Nubank Tiago', 'Nubank', 'Tiago', 27, 3),
    (v_casal_id, 'C6 Tiago',     'C6',     'Tiago', 4,  10),
    (v_casal_id, 'Sicoob Tiago', 'Sicoob', 'Tiago', 1,  11),
    (v_casal_id, 'BRB Maria',    'BRB',    'Maria', 20, 5);

  INSERT INTO categorias (casal_id, nome, icone, cor) VALUES
    (v_casal_id, 'Alimentação',        '🍔', '#ef5757'),
    (v_casal_id, 'Moradia',            '🏠', '#5b6ef5'),
    (v_casal_id, 'Transporte',         '🚗', '#e08a2e'),
    (v_casal_id, 'Saúde/Esporte',      '🏋️', '#1fa97c'),
    (v_casal_id, 'Lazer',              '🎮', '#a855f7'),
    (v_casal_id, 'Serviços',           '🔧', '#6b6962'),
    (v_casal_id, 'Educação/Trabalho',  '📚', '#0891b2'),
    (v_casal_id, 'Vestuário',          '👕', '#db2777'),
    (v_casal_id, 'Saúde',              '🩺', '#dc2626'),
    (v_casal_id, 'Investimento',       '📈', '#18895f'),
    (v_casal_id, 'Presente/Outros',    '🎁', '#9ca3af'),
    (v_casal_id, 'Receita',            '💰', '#4757d6');

  SELECT id INTO v_cat_moradia           FROM categorias WHERE casal_id = v_casal_id AND nome = 'Moradia';
  SELECT id INTO v_cat_servicos          FROM categorias WHERE casal_id = v_casal_id AND nome = 'Serviços';
  SELECT id INTO v_cat_lazer             FROM categorias WHERE casal_id = v_casal_id AND nome = 'Lazer';
  SELECT id INTO v_cat_educacao_trabalho FROM categorias WHERE casal_id = v_casal_id AND nome = 'Educação/Trabalho';
  SELECT id INTO v_cat_transporte        FROM categorias WHERE casal_id = v_casal_id AND nome = 'Transporte';
  SELECT id INTO v_cat_saude_esporte     FROM categorias WHERE casal_id = v_casal_id AND nome = 'Saúde/Esporte';

  INSERT INTO despesas_fixas (casal_id, descricao, valor, categoria_id, pagamento, dia_vencimento) VALUES
    (v_casal_id, 'Aluguel',              2156.00, v_cat_moradia,           'Sicoob Tiago', 5),
    (v_casal_id, 'Condomínio',           650.00,  v_cat_moradia,           'Sicoob Tiago', 10),
    (v_casal_id, 'Luz',                  130.00,  v_cat_moradia,           'Sicoob Tiago', 15),
    (v_casal_id, 'Internet',             99.90,   v_cat_servicos,          'Nubank Tiago', 27),
    (v_casal_id, 'Streamings',           100.00,  v_cat_lazer,             'Nubank Tiago', 27),
    (v_casal_id, 'IAs',                  450.00,  v_cat_educacao_trabalho, 'Nubank Tiago', 27),
    (v_casal_id, 'Celular',              100.00,  v_cat_servicos,          'Nubank Tiago', 27),
    (v_casal_id, 'Gasolina (estimativa)',700.00,  v_cat_transporte,        'Nubank Tiago', 27),
    (v_casal_id, 'Futevôlei',            290.00,  v_cat_saude_esporte,     'Sicoob Tiago', 10),
    (v_casal_id, 'Academia Madu',        71.25,   v_cat_saude_esporte,     'Nubank Tiago', 27),
    (v_casal_id, 'Beach Tennis Madu',    200.00,  v_cat_saude_esporte,     'Sicoob Tiago', 5);
END $$;
