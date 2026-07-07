-- Sincronização por código do casal (Finanças T&D v2).
-- Uma linha por código, com o estado completo do app em JSONB.
-- O código longo e aleatório (ex.: K3JF-9QWM-P2XA) funciona como a chave de
-- acesso do casal. Para a versão comercial, trocar por Supabase Auth + RLS
-- por usuário.

create table if not exists public.casais_sync (
  codigo text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table public.casais_sync enable row level security;

-- Acesso via anon key: quem tem o código lê/escreve a própria linha.
create policy "casais_sync_select" on public.casais_sync
  for select using (true);
create policy "casais_sync_insert" on public.casais_sync
  for insert with check (true);
create policy "casais_sync_update" on public.casais_sync
  for update using (true);
