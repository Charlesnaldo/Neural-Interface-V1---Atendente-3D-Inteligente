-- Version matches the migration applied to the remote Zord project.
create table public.zord_assistant_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint zord_state_shape check (
    jsonb_typeof(data) = 'object' and data->>'version' = '1'
    and jsonb_typeof(data->'history') = 'array' and jsonb_array_length(data->'history') <= 100
    and jsonb_typeof(data->'memories') = 'array' and jsonb_array_length(data->'memories') <= 100
    and jsonb_typeof(data->'tasks') = 'array' and jsonb_array_length(data->'tasks') <= 100
    and octet_length(data::text) <= 2000000
  )
);
alter table public.zord_assistant_state enable row level security;
revoke all on public.zord_assistant_state from anon;
grant select, insert, update, delete on public.zord_assistant_state to authenticated;
create policy zord_state_owner on public.zord_assistant_state for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_zord_state(p_data jsonb, p_revision bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare next_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_revision = 0 then
    insert into public.zord_assistant_state(user_id, data, revision)
    values (auth.uid(), p_data, 1) on conflict do nothing returning revision into next_revision;
  else
    update public.zord_assistant_state set data = p_data, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = p_revision returning revision into next_revision;
  end if;
  return next_revision;
end; $$;
revoke all on function public.save_zord_state(jsonb, bigint) from public, anon;
grant execute on function public.save_zord_state(jsonb, bigint) to authenticated;

create table public.zord_faces (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  photo_path text not null,
  encoding jsonb,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  constraint zord_photo_owner_path check (photo_path = user_id::text || '/' || id::text || '.jpg'),
  constraint zord_encoding_shape check (encoding is null or
    (jsonb_typeof(encoding) = 'object' and encoding->>'backend' in ('sface','dlib')
    and jsonb_typeof(encoding->'vector') = 'array' and jsonb_array_length(encoding->'vector') = 128))
);
create index zord_faces_owner_seen on public.zord_faces(user_id, last_seen desc);
alter table public.zord_faces enable row level security;
revoke all on public.zord_faces from anon;
grant select, insert, update, delete on public.zord_faces to authenticated;
create policy zord_faces_owner on public.zord_faces for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('zord-faces', 'zord-faces', false, 2000000, array['image/jpeg']);
create policy zord_photos_read on storage.objects for select to authenticated
using (bucket_id = 'zord-faces' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy zord_photos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'zord-faces' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy zord_photos_update on storage.objects for update to authenticated
using (bucket_id = 'zord-faces' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'zord-faces' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy zord_photos_delete on storage.objects for delete to authenticated
using (bucket_id = 'zord-faces' and (storage.foldername(name))[1] = (select auth.uid())::text);
