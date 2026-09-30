/**
 * TanStack Query keys in one place. Keys are hierarchical: invalidating ['teachers'] refreshes
 * every teachers list, option list and detail at once.
 */
export const queryKeys = {
  teachers: {
    all: ['teachers'],
    list: (params: object) => ['teachers', 'list', params],
    options: () => ['teachers', 'options'],
    students: (teacherId: string | null | undefined) => ['teachers', 'students', teacherId],
  },
  students: {
    all: ['students'],
    list: (params: object) => ['students', 'list', params],
    options: () => ['students', 'options'],
    assignments: (studentId: string | null | undefined) => ['students', 'assignments', studentId],
  },
  schedules: {
    all: ['schedules'],
    range: (params: object) => ['schedules', 'range', params],
  },
  payments: {
    all: ['payments'],
    list: (params: object) => ['payments', 'list', params],
    history: (paymentId: string | null | undefined) => ['payments', 'history', paymentId],
  },
  dashboard: {
    all: ['dashboard'],
  },
  users: {
    all: ['users'],
    list: () => ['users', 'list'],
  },
  portal: {
    all: ['portal'],
    students: () => ['portal', 'students'],
    schedule: (params: object) => ['portal', 'schedule', params],
    payments: () => ['portal', 'payments'],
  },
} as const
