-- Informação Contratantes → Associações
-- 1) Configuração de documentos por contratante (e o modelo "Padrão", id '__padrao__')
-- 2) Associações (acompanhamento do que isentar / ignorar / desisentar / adicionar no GTSoft)

create table if not exists public.contratantes_assoc_perfis (
  contratante_id text        primary key,
  dados          jsonb       not null default '{}',
  updated_by     uuid        default auth.uid(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.contratantes_associacoes (
  id          uuid        primary key default gen_random_uuid(),
  dados       jsonb       not null default '{}',
  status      text        not null default 'em_andamento',
  created_by  uuid        default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_contratantes_associacoes_status on public.contratantes_associacoes(status);

drop trigger if exists contratantes_assoc_perfis_updated_at on public.contratantes_assoc_perfis;
create trigger contratantes_assoc_perfis_updated_at
  before update on public.contratantes_assoc_perfis
  for each row execute function public.set_updated_at();

drop trigger if exists contratantes_associacoes_updated_at on public.contratantes_associacoes;
create trigger contratantes_associacoes_updated_at
  before update on public.contratantes_associacoes
  for each row execute function public.set_updated_at();

alter table public.contratantes_assoc_perfis enable row level security;
alter table public.contratantes_associacoes  enable row level security;

drop policy if exists "cap_all" on public.contratantes_assoc_perfis;
create policy "cap_all" on public.contratantes_assoc_perfis
  for all to authenticated using (true) with check (true);

drop policy if exists "cas_all" on public.contratantes_associacoes;
create policy "cas_all" on public.contratantes_associacoes
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.contratantes_assoc_perfis to authenticated;
grant select, insert, update, delete on public.contratantes_associacoes  to authenticated;
