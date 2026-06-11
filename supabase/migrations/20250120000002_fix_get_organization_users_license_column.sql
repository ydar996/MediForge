-- Fix get_organization_users RPC function to use license_number instead of medical_license_number
-- The column was renamed from medical_license_number to license_number in migration 20250118000012

-- Drop the existing function first (required when changing return type)
drop function if exists public.get_organization_users(uuid);

-- Recreate the function with the correct column name
create function public.get_organization_users(p_org_id uuid)
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

