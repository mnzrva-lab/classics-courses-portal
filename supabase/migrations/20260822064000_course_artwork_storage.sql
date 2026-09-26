insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-artwork',
  'course-artwork',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy course_artwork_admin_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'course-artwork' and private.is_admin());

create policy course_artwork_admin_select
on storage.objects
for select
to authenticated
using (bucket_id = 'course-artwork' and private.is_admin());

create policy course_artwork_admin_update
on storage.objects
for update
to authenticated
using (bucket_id = 'course-artwork' and private.is_admin())
with check (bucket_id = 'course-artwork' and private.is_admin());

create policy course_artwork_admin_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'course-artwork' and private.is_admin());
