-- Informação Contratantes → Associações
-- Configuração de documentos por contratante (e a lista "Padrão", id '__padrao__').
-- A associação em si (o checklist de etapas) não é gravada — fica só na tela.

create table if not exists public.contratantes_assoc_perfis (
  contratante_id text        primary key,
  dados          jsonb       not null default '{}',
  updated_by     uuid        default auth.uid(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists contratantes_assoc_perfis_updated_at on public.contratantes_assoc_perfis;
create trigger contratantes_assoc_perfis_updated_at
  before update on public.contratantes_assoc_perfis
  for each row execute function public.set_updated_at();

alter table public.contratantes_assoc_perfis enable row level security;

drop policy if exists "cap_all" on public.contratantes_assoc_perfis;
create policy "cap_all" on public.contratantes_assoc_perfis
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.contratantes_assoc_perfis to authenticated;

-- Tabela do antigo "acompanhamento" (Em andamento / Concluídas), que deixou de existir.
drop table if exists public.contratantes_associacoes;
