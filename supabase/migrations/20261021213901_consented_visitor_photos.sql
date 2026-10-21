-- Voluntary self-portraits only. Camera permission is not storage consent.
create schema if not exists zord_private;
revoke all on schema zord_private from public;
grant usage on schema zord_private to anon, authenticated;
create table zord_private.admin_emails(email text primary key);
alter table zord_private.admin_emails enable row level security;
revoke all on zord_private.admin_emails from public, anon, authenticated;
create function zord_private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists(select 1 from zord_private.admin_emails where email = lower(auth.jwt()->>'email'));
$$;
revoke all on function zord_private.is_admin() from public, anon;
grant execute on function zord_private.is_admin() to authenticated;
create table public.zord_visitor_photos (
 id uuid primary key default gen_random_uuid(),
 visitor_name text not null check(length(visitor_name)<=80),
 photo_base64 text not null check(length(photo_base64) between 100 and 120000),
 consent_version text not null check(consent_version='visitor-photo-v1'),
 created_at timestamptz not null default now(),
 receipt_hash bytea not null unique
);
alter table public.zord_visitor_photos enable row level security;
revoke all on public.zord_visitor_photos from public, anon, authenticated;
grant select(id,visitor_name,photo_base64,consent_version,created_at), delete on public.zord_visitor_photos to authenticated;
create policy admin_read on public.zord_visitor_photos for select to authenticated using ((select zord_private.is_admin()));
create policy admin_delete on public.zord_visitor_photos for delete to authenticated using ((select zord_private.is_admin()));
-- Narrow anonymous insert/delete capabilities: no public read or arbitrary writes.
create function zord_private.submit_photo(p_photo text,p_name text,p_secret text,p_consent boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_id uuid; decoded bytea;
begin
 if p_consent is distinct from true or p_secret is null or p_secret !~ '^[a-f0-9]{64}$' or p_photo is null or length(p_photo) not between 100 and 120000 or p_name is null or length(p_name)>80 then raise exception 'Invalid consent or photo'; end if;
 decoded := decode(p_photo,'base64');
 if substring(decoded from 1 for 2) <> decode('ffd8','hex') or substring(decoded from length(decoded)-1 for 2) <> decode('ffd9','hex') then raise exception 'JPEG required'; end if;
 perform pg_advisory_xact_lock(71248210);
 if (select count(*) from public.zord_visitor_photos)>=1000 or (select count(*) from public.zord_visitor_photos where created_at>now()-interval '1 minute')>=10 then raise exception 'Photo capacity reached. Try later.'; end if;
 insert into public.zord_visitor_photos(visitor_name,photo_base64,consent_version,receipt_hash) values(trim(p_name),p_photo,'visitor-photo-v1',sha256(convert_to(p_secret,'UTF8'))) returning id into new_id;
 return new_id;
end $$;
create function zord_private.withdraw_photo(p_id uuid,p_secret text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if p_secret is null or p_secret !~ '^[a-f0-9]{64}$' then return false; end if;
 delete from public.zord_visitor_photos where receipt_hash=sha256(convert_to(p_secret,'UTF8'));
 return found;
end $$;
revoke all on function zord_private.submit_photo(text,text,text,boolean), zord_private.withdraw_photo(uuid,text) from public;
grant execute on function zord_private.submit_photo(text,text,text,boolean), zord_private.withdraw_photo(uuid,text) to anon, authenticated;
create function public.submit_visitor_photo(p_photo text,p_name text,p_secret text,p_consent boolean) returns uuid language sql security invoker set search_path='' as $$ select zord_private.submit_photo(p_photo,p_name,p_secret,p_consent); $$;
create function public.withdraw_visitor_photo(p_id uuid,p_secret text) returns boolean language sql security invoker set search_path='' as $$ select zord_private.withdraw_photo(p_id,p_secret); $$;
revoke all on function public.submit_visitor_photo(text,text,text,boolean), public.withdraw_visitor_photo(uuid,text) from public;
grant execute on function public.submit_visitor_photo(text,text,text,boolean), public.withdraw_visitor_photo(uuid,text) to anon, authenticated;
