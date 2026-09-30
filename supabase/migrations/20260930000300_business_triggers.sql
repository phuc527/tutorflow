-- =============================================================================
-- TutorFlow 0003: server-owned fields and payment audit trail
-- =============================================================================
-- Rule: fields that record "who/when" are never trusted from the client.
-- The triggers overwrite whatever was sent, using auth.uid() and now().

-- schedules.created_by
create or replace function private.schedules_set_owner_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger schedules_owner_fields
  before insert or update on public.schedules
  for each row execute function private.schedules_set_owner_fields();

-- payments.paid_at / marked_by (business rules 11 & 12)
create or replace function private.payments_set_status_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.marked_by := coalesce((select auth.uid()), new.marked_by);
    new.paid_at := case when new.status = 'paid' then now() else null end;
  else
    -- Status unchanged (e.g. only the note was edited): keep the original marking.
    new.paid_at := old.paid_at;
    new.marked_by := old.marked_by;
  end if;

  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger payments_status_fields
  before insert or update on public.payments
  for each row execute function private.payments_set_status_fields();

-- Audit: every status change appends a row to payment_history.
-- SECURITY DEFINER because clients have no INSERT privilege on payment_history at all:
-- the only way a history row can appear is through this trigger.
create or replace function private.payments_write_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.payment_history (payment_id, old_status, new_status, changed_by)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      new.marked_by
    );
  end if;
  return new;
end;
$$;

create trigger payments_history
  after insert or update of status on public.payments
  for each row execute function private.payments_write_history();
