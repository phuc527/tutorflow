/**
 * Turn Supabase / Postgres errors into messages a user can act on.
 * The database is the source of truth for validation (constraints, RLS), so its error codes
 * are translated here once instead of in every component.
 *
 * SQLSTATE codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

// Specific constraint names (from the migrations) → message.
const CONSTRAINT_MESSAGES: Record<string, string> = {
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

const CODE_MESSAGES: Record<string, string> = {
  '42501': 'You don’t have permission to do that.',
  '23505': 'This record already exists.',
  '23503': 'This record is linked to other data and can’t be changed or deleted.',
  '23001': 'This record has classes or payment history and can’t be deleted. Set it to inactive instead.',
  '23514': 'Some values are invalid.',
  '23P01': 'This time slot conflicts with an existing class.',
  '22P02': 'Some values have an invalid format.',
  PGRST116: 'The record was not found or you don’t have access to it.',
}

/** The fields we read from Postgres, PostgREST and Supabase Auth errors (all optional). */
interface RawError {
  message?: string
  details?: string
  code?: string
  name?: string
  __isAuthError?: boolean
}

function findConstraint(error: RawError) {
  const text = `${error.message ?? ''} ${error.details ?? ''}`
  return Object.keys(CONSTRAINT_MESSAGES).find((name) => text.includes(name))
}

/** Thrown when an update matched no row because someone else changed it first (optimistic concurrency). */
export const STALE_WRITE = 'STALE_WRITE'

export class AppError extends Error {
  code: string | undefined

  constructor(message: string, { code, cause }: { code?: string; cause?: unknown } = {}) {
    super(message, { cause })
    this.name = 'AppError'
    this.code = code
  }
}

/** Convert any thrown value into an AppError with a friendly message (keeps the original as `cause`). */
export function toAppError(thrown: unknown): AppError {
  if (thrown instanceof AppError) return thrown
  if (!thrown) return new AppError('Unknown error')

  const error: RawError = typeof thrown === 'object' ? (thrown as RawError) : { message: String(thrown) }
  const code = error.code
  const constraint = findConstraint(error)
  if (constraint) return new AppError(CONSTRAINT_MESSAGES[constraint]!, { code, cause: thrown })
  if (code && CODE_MESSAGES[code]) return new AppError(CODE_MESSAGES[code], { code, cause: thrown })

  // Sign-up refused by the allowlist trigger (migration 0008). Supabase Auth hides the database
  // error behind this generic message; at sign-up it only happens for emails not on a teacher or student record.
  if (error.message === 'Database error saving new user') {
    return new AppError(
      'This email isn’t registered with your tutoring center. Ask the center to add it to your student or teacher record first.',
      { code, cause: thrown },
    )
  }
  // Supabase Auth errors already carry readable messages ("Invalid login credentials").
  if (error.name === 'AuthApiError' || error.__isAuthError) {
    return new AppError(error.message ?? 'Authentication failed', { code, cause: thrown })
  }
  if (thrown instanceof TypeError && /fetch/i.test(thrown.message)) {
    return new AppError('Can’t reach the server. Check your internet connection.', { cause: thrown })
  }
  return new AppError(error.message || 'Something went wrong', { code, cause: thrown })
}

/** The message of anything caught in a `catch` block. */
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** A supabase-js result: a union of `{ data, error: null }` and `{ data: null, error }`. */
type Result = { data: unknown; error: RawError | null; count?: number | null }

/** The data type of the success branch of a supabase-js result. */
type SuccessData<R> = R extends { error: null; data: infer D } ? D : never

/** Unwrap a supabase-js `{ data, error }` result: return data or throw a friendly AppError. */
export function unwrap<R extends Result>(result: R): SuccessData<R> {
  if (result.error) throw toAppError(result.error)
  return result.data as SuccessData<R>
}

/** Like unwrap, for queries made with `{ count: 'exact' }`: returns the page of rows plus the total. */
export function unwrapPage<R extends Result>(result: R): { data: SuccessData<R>; count: number } {
  return { data: unwrap(result), count: result.count ?? 0 }
}
