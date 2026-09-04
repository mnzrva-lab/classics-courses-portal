alter table public.materials
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;

alter table public.materials alter column url drop not null;

alter table public.materials drop constraint if exists material_has_source;
alter table public.materials
  add constraint material_has_source check (
    url is not null or (storage_bucket is not null and storage_path is not null)
  );

create index if not exists materials_storage_object_idx
  on public.materials(storage_bucket, storage_path)
  where storage_path is not null;

insert into storage.buckets (id, name, public, file_size_limit)
values ('teaching-materials', 'teaching-materials', false, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create policy "teaching_materials_admin_select"
on storage.objects for select
to authenticated
using (bucket_id = 'teaching-materials' and private.is_admin());

create policy "teaching_materials_published_select"
on storage.objects for select
to anon, authenticated
using (
  bucket_id = 'teaching-materials'
  and exists (
    select 1
    from public.materials m
    where m.storage_bucket = storage.objects.bucket_id
      and m.storage_path = storage.objects.name
      and m.status = 'published'
  )
);

create policy "teaching_materials_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'teaching-materials' and private.is_admin());

create policy "teaching_materials_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'teaching-materials' and private.is_admin())
with check (bucket_id = 'teaching-materials' and private.is_admin());

create policy "teaching_materials_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'teaching-materials' and private.is_admin());
