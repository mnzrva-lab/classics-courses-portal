create table if not exists public.user_tibetan_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id uuid not null references public.tibetan_terms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, term_id)
);

create table if not exists public.user_tibetan_flashcard_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  term_id uuid not null references public.tibetan_terms(id) on delete cascade,
  learning_state text not null default 'learning' check (learning_state in ('learning', 'learned')),
  review_count integer not null default 0 check (review_count >= 0),
  correct_count integer not null default 0 check (correct_count >= 0 and correct_count <= review_count),
  last_result text check (last_result is null or last_result in ('again', 'learning', 'learned')),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, term_id)
);

create index if not exists user_tibetan_bookmarks_term_idx on public.user_tibetan_bookmarks(term_id);
create index if not exists user_tibetan_flashcard_progress_term_idx on public.user_tibetan_flashcard_progress(term_id);
create index if not exists user_tibetan_flashcard_progress_user_state_idx on public.user_tibetan_flashcard_progress(user_id, learning_state);

alter table public.user_tibetan_bookmarks enable row level security;
alter table public.user_tibetan_flashcard_progress enable row level security;

grant select, insert, delete on public.user_tibetan_bookmarks to authenticated;
grant select, insert, update, delete on public.user_tibetan_flashcard_progress to authenticated;
grant all on public.user_tibetan_bookmarks to service_role;
grant all on public.user_tibetan_flashcard_progress to service_role;

drop policy if exists user_tibetan_bookmarks_own_all on public.user_tibetan_bookmarks;
create policy user_tibetan_bookmarks_own_all
on public.user_tibetan_bookmarks
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists user_tibetan_flashcard_progress_own_all on public.user_tibetan_flashcard_progress;
create policy user_tibetan_flashcard_progress_own_all
on public.user_tibetan_flashcard_progress
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
