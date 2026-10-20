-- Bereket v2 güncellemesi: yalnızca bu dosyayı çalıştırın (ilk kurulumu daha önce yaptıysanız).
-- Supabase → SQL Editor → New query → yapıştır → Run.
create table if not exists public.photos (
  id         text primary key,
  username   text not null references public.accounts (username) on delete cascade,
  entry_id   text not null,
  type       text not null default 'image/jpeg',
  data       text not null,
  created_at timestamptz not null default now()
);
create index if not exists photos_user_idx on public.photos (username);
alter table public.photos enable row level security;
revoke all on public.photos from anon, authenticated;
