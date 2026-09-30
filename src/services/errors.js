/**
 * Turn Supabase / Postgres errors into messages a user can act on.
 * The database is the source of truth for validation (constraints, RLS), so its error codes
 * are translated here once instead of in every component.
 *
 * SQLSTATE codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

// Specific constraint names (from the migrations) → message.
const CONSTRAINT_MESSAGES = {
  schedules_no_teacher_overlap: 'This teacher already has a class that overlaps this time.',
  schedules_no_student_overlap: 'This student already has a class at this time (possibly with another teacher).',
  schedules_time_order: 'End time must be later than start time.',
  schedules_max_duration: 'A class cannot be longer than 12 hours.',
  payments_one_per_month: 'A payment record for this student, teacher and month already exists.',
  payments_paid_at_matches_status: 'Paid records must have a paid date; unpaid records must not.',
  teacher_students_unique: 'This student is already assigned to this teacher.',
  teachers_email_key: 'A teacher with this email already exists.',
  // ON DELETE RESTRICT (migration 0007): records with history are deactivated, not deleted.
  schedules_teacher_id_fkey: 'This teacher has classes on the calendar and can’t be deleted. Set them to Inactive instead.',
  schedules_student_id_fkey: 'This student has classes on the calendar and can’t be deleted. Set them to Inactive instead.',
  payments_teacher_id_fkey: 'This teacher has payment records and can’t be deleted. Set them to Inactive instead.',
  payments_student_id_fkey: 'This student has payment records and can’t be deleted. Set them to Inactive instead.',
  payments_amount_locked: 'The amount of a paid record can’t be changed. Mark it unpaid first.',
  payments_schedule_mismatch: 'The linked class does not belong to this teacher and student.',
  role_invalid: 'Accounts can only be students or teachers here.',
  role_self: 'You can’t change your own role.',
  role_admin_target: 'Administrator accounts can only be changed in the database.',
  link_not_student: 'Only student accounts can be linked to students.',
  range_invalid: 'Choose a shorter date range.',
}

const CODE_MESSAGES = {
  '42501': 'You don’t have permission to do that.',
  '23505': 'This record already exists.',
  '23503': 'This record is linked to other data and can’t be changed or deleted.',
  '23001': 'This record has classes or payment history and can’t be deleted. Set it to inactive instead.',
  '23514': 'Some values are invalid.',
  '23P01': 'This time slot conflicts with an existing class.',
  '22P02': 'Some values have an invalid format.',
  PGRST116: 'The record was not found or you don’t have access to it.',
}

function findConstraint(error) {
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`
  return Object.keys(CONSTRAINT_MESSAGES).find((name) => text.includes(name))
}

/** Thrown when an update matched no row because someone else changed it first (optimistic concurrency). */
export const STALE_WRITE = 'STALE_WRITE'

export class AppError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message, { cause })
    this.name = 'AppError'
    this.code = code
  }
}

/** Convert any thrown value into an AppError with a friendly message (keeps the original as `cause`). */
export function toAppError(error) {
  if (error instanceof AppError) return error
  if (!error) return new AppError('Unknown error')

  const constraint = findConstraint(error)
  if (constraint) return new AppError(CONSTRAINT_MESSAGES[constraint], { code: error.code, cause: error })
  if (CODE_MESSAGES[error.code]) return new AppError(CODE_MESSAGES[error.code], { code: error.code, cause: error })

  // Sign-up refused by the allowlist trigger (migration 0008). Supabase Auth hides the database
  // error behind this generic message; at sign-up it only happens for emails not on a teacher or student record.
  if (error.message === 'Database error saving new user') {
    return new AppError(
      'This email isn’t registered with your tutoring center. Ask the center to add it to your student or teacher record first.',
      { code: error.code, cause: error },
    )
  }
  // Supabase Auth errors already carry readable messages ("Invalid login credentials").
  if (error.name === 'AuthApiError' || error.__isAuthError) {
    return new AppError(error.message, { code: error.code, cause: error })
  }
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return new AppError('Can’t reach the server. Check your internet connection.', { cause: error })
  }
  return new AppError(error.message || 'Something went wrong', { code: error.code, cause: error })
}

/** Unwrap a supabase-js `{ data, error }` result: return data or throw a friendly AppError. */
export function unwrap({ data, error, count }) {
  if (error) throw toAppError(error)
  return count === undefined || count === null ? data : { data, count }
}
