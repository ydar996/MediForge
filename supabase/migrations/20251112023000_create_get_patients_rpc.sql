                                                    create or replace function public.get_patients_for_org(
                                                      p_org_id uuid
                                                    )
                                                    returns setof public.patients
                                                    language sql
                                                    security definer
                                                    set search_path = public
                                                    as $$
                                                      select *
                                                      from public.patients
                                                      where organization_id = p_org_id
                                                      order by coalesce(updated_at, created_at) desc;
                                                    $$;

                                                    revoke all on function public.get_patients_for_org(uuid) from public;
                                                    grant execute on function public.get_patients_for_org(uuid) to anon, authenticated;
