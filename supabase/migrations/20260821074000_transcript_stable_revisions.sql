alter table public.transcript_paragraphs
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.transcript_assets
  add column if not exists after_paragraph_id uuid references public.transcript_paragraphs(id) on delete set null;

update public.transcript_assets a
set after_paragraph_id = p.id
from public.transcript_paragraphs p
where a.after_paragraph_id is null
  and a.after_paragraph_sort_order >= 0
  and p.transcript_id = a.transcript_id
  and p.sort_order = a.after_paragraph_sort_order;

create index if not exists transcript_paragraphs_active_order_idx
  on public.transcript_paragraphs(transcript_id, is_active, sort_order);
create index if not exists transcript_assets_after_paragraph_idx
  on public.transcript_assets(after_paragraph_id);

create table if not exists public.transcript_revisions (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  snapshot jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (transcript_id, revision_number)
);

create index if not exists transcript_revisions_transcript_created_idx
  on public.transcript_revisions(transcript_id, created_at desc);

alter table public.transcript_revisions enable row level security;

drop policy if exists "transcript_revisions_admin_all" on public.transcript_revisions;
create policy "transcript_revisions_admin_all"
on public.transcript_revisions for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

grant select, insert, update, delete on public.transcript_revisions to authenticated;

create or replace function public.save_transcript_content(
  p_transcript_id uuid,
  p_session_id uuid,
  p_language_code text,
  p_title text,
  p_disclaimer text,
  p_source_file_name text,
  p_status text,
  p_sections jsonb,
  p_paragraphs jsonb,
  p_assets jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision_number integer := null;
  v_existing boolean := false;
begin
  if v_user_id is null or not private.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'Invalid transcript status';
  end if;

  select exists(select 1 from public.transcripts where id = p_transcript_id)
    into v_existing;

  if v_existing then
    select coalesce(max(revision_number), 0) + 1
      into v_revision_number
      from public.transcript_revisions
      where transcript_id = p_transcript_id;

    insert into public.transcript_revisions(transcript_id, revision_number, snapshot, created_by)
    select
      t.id,
      v_revision_number,
      jsonb_build_object(
        'transcript', jsonb_build_object(
          'id', t.id,
          'session_id', t.session_id,
          'language_code', t.language_code,
          'title', t.title,
          'disclaimer', t.disclaimer,
          'source_file_name', t.source_file_name,
          'status', t.status,
          'created_at', t.created_at,
          'updated_at', t.updated_at
        ),
        'sections', coalesce((
          select jsonb_agg(to_jsonb(s) order by s.sort_order)
          from public.transcript_sections s
          where s.transcript_id = t.id
        ), '[]'::jsonb),
        'paragraphs', coalesce((
          select jsonb_agg(to_jsonb(p) - 'search_vector' order by p.sort_order, p.created_at)
          from public.transcript_paragraphs p
          where p.transcript_id = t.id
        ), '[]'::jsonb),
        'assets', coalesce((
          select jsonb_agg(to_jsonb(a) order by a.sort_order)
          from public.transcript_assets a
          where a.transcript_id = t.id
        ), '[]'::jsonb)
      ),
      v_user_id
    from public.transcripts t
    where t.id = p_transcript_id;
  end if;

  insert into public.transcripts(
    id, session_id, language_code, title, disclaimer, source_file_name, status, updated_at
  ) values (
    p_transcript_id, p_session_id, coalesce(nullif(p_language_code, ''), 'en'), p_title,
    p_disclaimer, p_source_file_name, p_status, now()
  )
  on conflict (id) do update set
    title = excluded.title,
    disclaimer = excluded.disclaimer,
    source_file_name = excluded.source_file_name,
    status = excluded.status,
    updated_at = now();

  update public.transcript_paragraphs
  set section_id = null
  where transcript_id = p_transcript_id;

  delete from public.transcript_sections
  where transcript_id = p_transcript_id;

  insert into public.transcript_sections(id, transcript_id, slug, title, start_seconds, sort_order)
  select
    x.id,
    p_transcript_id,
    x.slug,
    x.title,
    x.start_seconds,
    x.sort_order
  from jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb)) as x(
    id uuid,
    slug text,
    title text,
    start_seconds integer,
    sort_order integer
  );

  insert into public.transcript_paragraphs(
    id, transcript_id, section_id, speaker, body, start_seconds, sort_order, is_active, updated_at
  )
  select
    x.id,
    p_transcript_id,
    x.section_id,
    x.speaker,
    x.body,
    x.start_seconds,
    x.sort_order,
    true,
    now()
  from jsonb_to_recordset(coalesce(p_paragraphs, '[]'::jsonb)) as x(
    id uuid,
    section_id uuid,
    speaker text,
    body text,
    start_seconds integer,
    sort_order integer
  )
  on conflict (id) do update set
    section_id = excluded.section_id,
    speaker = excluded.speaker,
    body = excluded.body,
    start_seconds = excluded.start_seconds,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

  update public.transcript_paragraphs p
  set is_active = false,
      section_id = null,
      updated_at = now()
  where p.transcript_id = p_transcript_id
    and not exists (
      select 1
      from jsonb_to_recordset(coalesce(p_paragraphs, '[]'::jsonb)) as x(id uuid)
      where x.id = p.id
    );

  delete from public.transcript_assets
  where transcript_id = p_transcript_id;

  insert into public.transcript_assets(
    id, transcript_id, after_paragraph_sort_order, after_paragraph_id, asset_type,
    storage_bucket, storage_path, mime_type, alt_text, caption, sort_order
  )
  select
    coalesce(x.id, gen_random_uuid()),
    p_transcript_id,
    x.after_paragraph_sort_order,
    x.after_paragraph_id,
    'image',
    x.storage_bucket,
    x.storage_path,
    x.mime_type,
    x.alt_text,
    x.caption,
    x.sort_order
  from jsonb_to_recordset(coalesce(p_assets, '[]'::jsonb)) as x(
    id uuid,
    after_paragraph_sort_order integer,
    after_paragraph_id uuid,
    storage_bucket text,
    storage_path text,
    mime_type text,
    alt_text text,
    caption text,
    sort_order integer
  );

  return jsonb_build_object(
    'ok', true,
    'revision_number', v_revision_number,
    'existing', v_existing
  );
end;
$$;

revoke all on function public.save_transcript_content(uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_transcript_content(uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb) to authenticated;
