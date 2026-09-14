create table if not exists public.tibetan_terms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  tibetan_script text,
  transliteration text not null,
  english_meaning text not null,
  explanation text,
  aliases text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tibetan_term_sources (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.tibetan_terms(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  session_id uuid references public.sessions(id) on delete set null,
  paragraph_id uuid references public.transcript_paragraphs(id) on delete set null,
  source_label text,
  external_url text,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tibetan_term_source_has_reference check (
    course_id is not null or session_id is not null or paragraph_id is not null or source_label is not null or external_url is not null
  )
);

create index if not exists tibetan_terms_status_sort_idx on public.tibetan_terms(status, sort_order, transliteration);
create index if not exists tibetan_term_sources_term_idx on public.tibetan_term_sources(term_id, sort_order);
create index if not exists tibetan_term_sources_session_idx on public.tibetan_term_sources(session_id) where session_id is not null;
create index if not exists tibetan_term_sources_paragraph_idx on public.tibetan_term_sources(paragraph_id) where paragraph_id is not null;

alter table public.tibetan_terms enable row level security;
alter table public.tibetan_term_sources enable row level security;

drop policy if exists tibetan_terms_public_read on public.tibetan_terms;
create policy tibetan_terms_public_read on public.tibetan_terms
for select using (status = 'published');

drop policy if exists tibetan_terms_admin_all on public.tibetan_terms;
create policy tibetan_terms_admin_all on public.tibetan_terms
for all using (private.is_admin()) with check (private.is_admin());

drop policy if exists tibetan_term_sources_public_read on public.tibetan_term_sources;
create policy tibetan_term_sources_public_read on public.tibetan_term_sources
for select using (
  exists (
    select 1 from public.tibetan_terms t
    where t.id = tibetan_term_sources.term_id and t.status = 'published'
  )
);

drop policy if exists tibetan_term_sources_admin_all on public.tibetan_term_sources;
create policy tibetan_term_sources_admin_all on public.tibetan_term_sources
for all using (private.is_admin()) with check (private.is_admin());
