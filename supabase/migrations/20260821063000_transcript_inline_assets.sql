create table if not exists public.transcript_assets (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  after_paragraph_sort_order integer not null default -1 check (after_paragraph_sort_order >= -1),
  asset_type text not null default 'image' check (asset_type in ('image')),
  storage_bucket text not null default 'transcript-assets',
  storage_path text not null,
  mime_type text,
  alt_text text,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (transcript_id, storage_bucket, storage_path)
);

create index if not exists transcript_assets_transcript_position_idx
  on public.transcript_assets(transcript_id, after_paragraph_sort_order, sort_order);

alter table public.transcript_assets enable row level security;

drop policy if exists "transcript_assets_admin_all" on public.transcript_assets;
create policy "transcript_assets_admin_all"
on public.transcript_assets for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists "transcript_assets_public_read" on public.transcript_assets;
create policy "transcript_assets_public_read"
on public.transcript_assets for select
to anon, authenticated
using (
  exists (
    select 1
    from public.transcripts t
    where t.id = transcript_assets.transcript_id
      and (t.status = 'published' or private.is_admin())
  )
);

grant select on public.transcript_assets to anon;
grant select, insert, update, delete on public.transcript_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('transcript-assets', 'transcript-assets', false, 20971520)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "transcript_assets_admin_select" on storage.objects;
create policy "transcript_assets_admin_select"
on storage.objects for select
to authenticated
using (bucket_id = 'transcript-assets' and private.is_admin());

drop policy if exists "transcript_assets_published_select" on storage.objects;
create policy "transcript_assets_published_select"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'transcript-assets'
  and exists (
    select 1
    from public.transcript_assets a
    join public.transcripts t on t.id = a.transcript_id
    where a.storage_bucket = storage.objects.bucket_id
      and a.storage_path = storage.objects.name
      and t.status = 'published'
  )
);

drop policy if exists "transcript_assets_admin_insert" on storage.objects;
create policy "transcript_assets_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'transcript-assets' and private.is_admin());

drop policy if exists "transcript_assets_admin_update" on storage.objects;
create policy "transcript_assets_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'transcript-assets' and private.is_admin())
with check (bucket_id = 'transcript-assets' and private.is_admin());

drop policy if exists "transcript_assets_admin_delete" on storage.objects;
create policy "transcript_assets_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'transcript-assets' and private.is_admin());
