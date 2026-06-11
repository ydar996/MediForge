create or replace function public.get_organizations_with_owner()
returns table (
  id uuid,
  name text,
  org_code text,
  country text,
  currency text,
  timezone text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  owner_user_id uuid,
  owner_username text,
  owner_first_name text,
  owner_last_name text,
  owner_email text,
  owner_role text,
  owner_created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    o.id,
    o.name,
    o.org_code,
    o.country,
    o.currency,
    null::text as timezone,
    coalesce(o.status, 'active') as status,
    o.created_at,
    o.updated_at,
    u.id as owner_user_id,
    u.username as owner_username,
    u.first_name as owner_first_name,
    u.last_name as owner_last_name,
    coalesce(au.email, o.email) as owner_email,
    u.role as owner_role,
    u.created_at as owner_created_at
  from public.organizations o
  left join lateral (
    select usr.*
    from public.users usr
    where usr.organization_id = o.id
    order by
      case
        when lower(coalesce(usr.role, '')) like '%owner%' then 0
        when lower(coalesce(usr.role, '')) like '%admin%' then 1
        when lower(coalesce(usr.role, '')) like '%doctor%' then 2
        when lower(coalesce(usr.role, '')) like '%nurse%' then 3
        else 4
      end,
      usr.created_at
    limit 1
  ) u on true
  left join auth.users au on au.id = u.auth_user_id
  order by o.created_at desc;
$$;

grant execute on function public.get_organizations_with_owner() to anon, authenticated;

create or replace function public.get_organization_users(p_org_id uuid)
returns table (
  id uuid,
  username text,
  first_name text,
  last_name text,
  email text,
  role text,
  license_number text,
  phone text,
  gender text,
  organization_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.username,
    u.first_name,
    u.last_name,
    coalesce(au.email, '') as email,
    u.role,
    u.license_number,
    u.phone,
    u.gender,
    u.organization_id,
    u.created_at,
    u.updated_at
  from public.users u
  left join auth.users au on au.id = u.auth_user_id
  where u.organization_id = p_org_id
  order by u.created_at;
$$;

grant execute on function public.get_organization_users(uuid) to anon, authenticated;
