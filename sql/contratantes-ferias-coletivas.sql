-- Férias coletivas por contratante: { inicio, fim (AAAA-MM-DD), contato, email }
alter table public.contratantes
  add column if not exists ferias_coletivas jsonb;
