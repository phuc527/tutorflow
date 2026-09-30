-- =============================================================================
-- TutorFlow 0005: atomic "set this student's teachers" operation
-- =============================================================================
-- Replacing a student's teacher list is a DELETE plus an INSERT. Sent as two separate API calls,
-- a failure in between would leave a half-updated assignment list. A function runs both in
-- one transaction: either all changes apply or none do.
--
-- SECURITY INVOKER (the default) means it runs with the CALLER's rights, so the RLS policies on
-- teacher_students still apply. The explicit admin check only gives a clearer error message.

create or replace function public.set_student_teachers(p_student_id uuid, p_teacher_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Only administrators can assign teachers' using errcode = '42501';
  end if;

  delete from public.teacher_students
  where student_id = p_student_id
    and teacher_id <> all (coalesce(p_teacher_ids, '{}'::uuid[]));

  insert into public.teacher_students (teacher_id, student_id)
  select distinct t.id, p_student_id
  from unnest(coalesce(p_teacher_ids, '{}'::uuid[])) as t(id)
  on conflict (teacher_id, student_id) do nothing;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default; lock it down.
revoke execute on function public.set_student_teachers(uuid, uuid[]) from public, anon;
grant execute on function public.set_student_teachers(uuid, uuid[]) to authenticated;
