-- =============================================================================
-- TutorFlow 0011: the admin manages schedules too
-- =============================================================================
-- Until now schedules were admin read-only. The admin may now create, edit and delete any teacher's
-- classes, with the same rule a teacher has: the student must be assigned to that teacher, and the
-- teacher must not be inactive. Overlap and duration constraints apply unchanged.
-- teacher_id stays non-updatable (column grant from 0004): a class never moves to another teacher.

create or replace function private.teacher_can_teach(p_teacher_id uuid, p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_students ts
    join public.teachers t on t.id = ts.teacher_id
    where ts.teacher_id = p_teacher_id
      and ts.student_id = p_student_id
      and t.status <> 'inactive'
  );
$$;
revoke execute on function private.teacher_can_teach(uuid, uuid) from public, anon;
grant execute on function private.teacher_can_teach(uuid, uuid) to authenticated, service_role;

create policy schedules_admin_insert on public.schedules
  for insert to authenticated
  with check ((select private.is_admin()) and private.teacher_can_teach(teacher_id, student_id));

create policy schedules_admin_update on public.schedules
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()) and private.teacher_can_teach(teacher_id, student_id));

create policy schedules_admin_delete on public.schedules
  for delete to authenticated
  using ((select private.is_admin()));
