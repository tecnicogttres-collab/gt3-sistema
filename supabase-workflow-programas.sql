create table workflow_programas_config ( id integer primary key default 1, dados jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), updated_por uuid references auth.users(id), updated_por_nome text, constraint workflow_programas_config_singleton check (id = 1) );

alter table workflow_programas_config enable row level security;

create table workflow_programas_analises ( id uuid primary key default gen_random_uuid(), empresa text, cnpj text, finalizada boolean not null default false, data_final date, criado_por uuid references auth.users(id), criado_por_nome text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), dados jsonb not null default '{}'::jsonb );

alter table workflow_programas_analises enable row level security;

create index workflow_programas_analises_finalizada_idx on workflow_programas_analises (finalizada);

create index workflow_programas_analises_criado_por_idx on workflow_programas_analises (criado_por);
