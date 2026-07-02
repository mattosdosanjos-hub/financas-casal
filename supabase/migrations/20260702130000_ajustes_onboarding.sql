-- ═══════════════════════════════════════════════════════════
-- Ajustes descobertos ao implementar o fluxo de onboarding/convite no Lovable
-- ═══════════════════════════════════════════════════════════

-- Código de convite do casal (compartilhado com o segundo membro para entrar)
ALTER TABLE casal
  ADD COLUMN codigo_convite TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8);

-- E-mail denormalizado em membros: o client autenticado não pode ler auth.users
-- diretamente (schema protegido), então precisamos do e-mail aqui para exibir
-- "convidado: fulano@..." sem exigir service role a cada leitura.
ALTER TABLE membros
  ADD COLUMN email TEXT;
