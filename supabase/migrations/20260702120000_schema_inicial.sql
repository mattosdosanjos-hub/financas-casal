-- ═══════════════════════════════════════════════════════════
-- Finanças T&D — schema inicial
-- Controle financeiro do casal (migração de Google Sheets)
-- ═══════════════════════════════════════════════════════════

-- ── Perfil do casal (um único registro) ──
CREATE TABLE casal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL DEFAULT 'T & D',
  meta_total NUMERIC(12,2) NOT NULL DEFAULT 100000,
  meta_mensal_aporte NUMERIC(12,2) NOT NULL DEFAULT 3000,
  valor_inicial_investimento NUMERIC(12,2) NOT NULL DEFAULT 75000,
  meta_prazo DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Membros do casal (vincula auth.users ao casal) ──
CREATE TABLE membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casal_id UUID NOT NULL REFERENCES casal(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, -- "Tiago" ou "Maria"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── Cartões de crédito (só os 4 oficiais — sem contas de débito separadas) ──
CREATE TABLE cartoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casal_id UUID NOT NULL REFERENCES casal(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, -- "Nubank Tiago"
  banco TEXT,
  titular TEXT,
  dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(casal_id, nome)
);

-- ── Categorias ──
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casal_id UUID NOT NULL REFERENCES casal(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  orcamento_mensal NUMERIC(12,2),
  icone TEXT,
  cor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(casal_id, nome)
);

-- ── Despesas fixas mensais ──
CREATE TABLE despesas_fixas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casal_id UUID NOT NULL REFERENCES casal(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  categoria_id UUID REFERENCES categorias(id),
  -- nome do cartão (cartoes.nome) ou 'Dinheiro/Pix'
  pagamento TEXT NOT NULL,
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Lançamentos (tabela principal) ──
CREATE TABLE lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casal_id UUID NOT NULL REFERENCES casal(id) ON DELETE CASCADE,
  lancado_por UUID NOT NULL REFERENCES auth.users(id),
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('Gasto', 'Receita', 'Investimento')),
  categoria_id UUID REFERENCES categorias(id),
  -- nome do cartão (cartoes.nome) ou 'Dinheiro/Pix' — só cartão gera lógica de mês fatura
  pagamento TEXT NOT NULL CHECK (
    pagamento IN ('Nubank Tiago', 'C6 Tiago', 'Sicoob Tiago', 'BRB Maria', 'Dinheiro/Pix')
  ),
  -- calculado no momento do lançamento pela lib mesFatura.ts — não editável na UI. Formato "Jun/2026"
  mes_fatura TEXT NOT NULL,
  parcela_atual INTEGER,
  parcela_total INTEGER,
  -- agrupa as parcelas de um mesmo lançamento parcelado
  grupo_parcelamento UUID,
  observacao TEXT,
  despesa_fixa_id UUID REFERENCES despesas_fixas(id),
  gerado_automaticamente BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lancamentos_casal_mes ON lancamentos(casal_id, mes_fatura);
CREATE INDEX idx_lancamentos_casal_data ON lancamentos(casal_id, data);
CREATE INDEX idx_lancamentos_grupo ON lancamentos(grupo_parcelamento) WHERE grupo_parcelamento IS NOT NULL;

-- ── Aportes de investimento (um por mês, acumulativo) ──
CREATE TABLE aportes_investimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casal_id UUID NOT NULL REFERENCES casal(id) ON DELETE CASCADE,
  mes TEXT NOT NULL, -- "Jun/2026"
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  lancamento_id UUID REFERENCES lancamentos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(casal_id, mes)
);

-- ── Projeção de receita por mês ──
CREATE TABLE projecao_receita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  casal_id UUID NOT NULL REFERENCES casal(id) ON DELETE CASCADE,
  mes TEXT NOT NULL, -- "Jun/2026"
  valor_projetado NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_realizado NUMERIC(12,2), -- preenchido ao fechar o mês
  diferenca NUMERIC(12,2) GENERATED ALWAYS AS (valor_realizado - valor_projetado) STORED,
  fechado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(casal_id, mes)
);

-- ═══════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════

-- Resolve o casal_id do usuário autenticado uma única vez por policy
CREATE OR REPLACE FUNCTION casal_id_atual()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT casal_id FROM membros WHERE user_id = auth.uid() LIMIT 1;
$$;

ALTER TABLE casal ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_fixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE aportes_investimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE projecao_receita ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membro le/edita o proprio casal" ON casal
  FOR ALL USING (id = casal_id_atual()) WITH CHECK (id = casal_id_atual());

-- membros: cada um só enxerga os colegas do próprio casal_id.
-- Inserção de novos membros (convite) é feita por uma edge function com service role,
-- não por policy de INSERT direta do cliente.
CREATE POLICY "membro ve colegas do casal" ON membros
  FOR SELECT USING (casal_id = casal_id_atual());

CREATE POLICY "membro acessa cartoes do casal" ON cartoes
  FOR ALL USING (casal_id = casal_id_atual()) WITH CHECK (casal_id = casal_id_atual());

CREATE POLICY "membro acessa categorias do casal" ON categorias
  FOR ALL USING (casal_id = casal_id_atual()) WITH CHECK (casal_id = casal_id_atual());

CREATE POLICY "membro acessa despesas fixas do casal" ON despesas_fixas
  FOR ALL USING (casal_id = casal_id_atual()) WITH CHECK (casal_id = casal_id_atual());

CREATE POLICY "membro acessa lancamentos do casal" ON lancamentos
  FOR ALL USING (casal_id = casal_id_atual()) WITH CHECK (casal_id = casal_id_atual());

CREATE POLICY "membro acessa aportes do casal" ON aportes_investimento
  FOR ALL USING (casal_id = casal_id_atual()) WITH CHECK (casal_id = casal_id_atual());

CREATE POLICY "membro acessa projecao do casal" ON projecao_receita
  FOR ALL USING (casal_id = casal_id_atual()) WITH CHECK (casal_id = casal_id_atual());
