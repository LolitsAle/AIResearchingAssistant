-- System Library schema for admin/dev managed documents.
-- Apply in Supabase after pgvector is enabled. Backend also checks access/vector
-- readiness, so RLS can stay conservative when using service_role.

create extension if not exists vector;

create table if not exists public.system_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  filename text not null,
  file_type text,
  description text,
  ai_summary text,
  page_count integer,
  word_count integer,
  difficulty_level text check (difficulty_level in ('basic', 'intermediate', 'advanced')) default 'intermediate',
  subject_area text default 'Khác',
  tags text[] not null default '{}',
  access_level text not null check (access_level in ('free', 'pro', 'vip')) default 'free',
  is_vector_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.system_documents(id) on delete cascade,
  content text not null,
  page_start integer,
  page_end integer,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create table if not exists public.system_document_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  document_id uuid not null references public.system_documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, document_id)
);

create index if not exists idx_system_documents_subject on public.system_documents(subject_area);
create index if not exists idx_system_documents_access on public.system_documents(access_level);
create index if not exists idx_system_documents_vector_ready on public.system_documents(is_vector_ready);
create index if not exists idx_system_documents_tags on public.system_documents using gin(tags);
create index if not exists idx_system_document_bookmarks_user on public.system_document_bookmarks(user_id);
create index if not exists idx_system_document_chunks_document on public.system_document_chunks(document_id);
create index if not exists idx_system_document_chunks_embedding on public.system_document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.research_sessions
  add column if not exists source_type text not null default 'user_document',
  add column if not exists selected_sources jsonb not null default '[]'::jsonb,
  add column if not exists user_id uuid;

alter table public.system_documents enable row level security;
alter table public.system_document_bookmarks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'system_documents' and policyname = 'Users can read free system documents') then
    create policy "Users can read free system documents"
      on public.system_documents for select
      using (access_level = 'free');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'system_document_bookmarks' and policyname = 'Users can read own system bookmarks') then
    create policy "Users can read own system bookmarks"
      on public.system_document_bookmarks for select
      using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'system_document_bookmarks' and policyname = 'Users can insert own system bookmarks') then
    create policy "Users can insert own system bookmarks"
      on public.system_document_bookmarks for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'system_document_bookmarks' and policyname = 'Users can delete own system bookmarks') then
    create policy "Users can delete own system bookmarks"
      on public.system_document_bookmarks for delete
      using (auth.uid() = user_id);
  end if;
end $$;
