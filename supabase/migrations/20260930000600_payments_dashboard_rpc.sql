-- =============================================================================
-- TutorFlow 0006: monthly payment generation and dashboard summary
-- =============================================================================
-- Both functions are SECURITY INVOKER: they run as the caller, so every table they touch is
-- filtered by the caller's RLS policies. No new privileges are introduced.

-- -----------------------------------------------------------------------------
-- Create this month's unpaid records for all of the calling teacher's active assigned students.
-- amount = hours scheduled with that student in the month × teacher's hourly rate (rounded to 1,000 đ).
-- Existing records are left untouched. Returns how many records were created.
-- -----------------------------------------------------------------------------
create or replace function public.generate_monthly_payments(p_billing_month date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_teacher_id  uuid := private.current_teacher_id();
  v_month       date := date_trunc('month', p_billing_month)::date;
  -- Month boundaries as instants, measured in Vietnam local time.
  v_from        timestamptz := v_month::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_to          timestamptz := (v_month + interval '1 month')::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_created     integer;
begin
  if v_teacher_id is null then
    raise exception 'Only active teachers can create payment records' using errcode = '42501';
  end if;

  insert into public.payments (student_id, teacher_id, billing_month, amount)
  select
    ts.student_id,
    v_teacher_id,
    v_month,
    coalesce(round(hours.total * t.hourly_rate, -3), 0)
  from public.teacher_students ts
  join public.students st on st.id = ts.student_id and st.status = 'active'
  join public.teachers t on t.id = v_teacher_id
  left join lateral (
    select sum(extract(epoch from (s.end_time - s.start_time)) / 3600.0) as total
    from public.schedules s
    where s.teacher_id = v_teacher_id
      and s.student_id = ts.student_id
      and s.start_time >= v_from
      and s.start_time < v_to
  ) hours on true
  where ts.teacher_id = v_teacher_id
  on conflict (student_id, teacher_id, billing_month) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$$;

revoke execute on function public.generate_monthly_payments(date) from public, anon;
grant execute on function public.generate_monthly_payments(date) to authenticated;

-- -----------------------------------------------------------------------------
-- Dashboard numbers in one round trip. Because of RLS, an admin gets centre-wide figures
-- and a teacher gets figures for their own students/classes/payments, from the same SQL.
-- "Today" and "this month" are computed in Asia/Ho_Chi_Minh.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_months integer default 6)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today       date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_day_start   timestamptz := v_today::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_month       date := date_trunc('month', v_today)::date;
  v_result      jsonb;
begin
  with student_month as (
    -- A student counts as paid when every record they have this month is paid.
    select p.student_id, bool_and(p.status = 'paid') as all_paid
    from public.payments p
    where p.billing_month = v_month
    group by p.student_id
  ),
  months as (
    select (v_month - make_interval(months => n))::date as billing_month
    from generate_series(greatest(least(p_months, 24), 1) - 1, 0, -1) as n
  ),
  monthly as (
    select
      m.billing_month,
      coalesce(sum(p.amount) filter (where p.status = 'paid'), 0)   as paid_amount,
      coalesce(sum(p.amount) filter (where p.status = 'unpaid'), 0) as unpaid_amount,
      count(p.id) filter (where p.status = 'paid')                  as paid_count,
      count(p.id) filter (where p.status = 'unpaid')                as unpaid_count
    from months m
    left join public.payments p on p.billing_month = m.billing_month
    group by m.billing_month
  )
  select jsonb_build_object(
    'today', v_today,
    'billing_month', v_month,
    'teachers', (select count(*) from public.teachers t where t.status <> 'inactive'),
    'students', (select count(*) from public.students s where s.status = 'active'),
    'today_classes', (
      select count(*) from public.schedules s
      where s.start_time >= v_day_start and s.start_time < v_day_start + interval '1 day'
    ),
    'paid_students', (select count(*) from student_month where all_paid),
    'unpaid_students', (select count(*) from student_month where not all_paid),
    'monthly', (
      select jsonb_agg(to_jsonb(monthly) order by monthly.billing_month) from monthly
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.dashboard_summary(integer) from public, anon;
grant execute on function public.dashboard_summary(integer) to authenticated;
