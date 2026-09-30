/**
 * TanStack Query keys in one place. Keys are hierarchical: invalidating ['teachers'] refreshes
 * every teachers list, option list and detail at once.
 */
export const queryKeys = {
  teachers: {
    all: ['teachers'],
    list: (params) => ['teachers', 'list', params],
    options: () => ['teachers', 'options'],
  },
  students: {
    all: ['students'],
    list: (params) => ['students', 'list', params],
    options: () => ['students', 'options'],
    assignments: (studentId) => ['students', 'assignments', studentId],
  },
  schedules: {
    all: ['schedules'],
    range: (params) => ['schedules', 'range', params],
  },
  payments: {
    all: ['payments'],
    list: (params) => ['payments', 'list', params],
    history: (paymentId) => ['payments', 'history', paymentId],
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
    schedule: (params) => ['portal', 'schedule', params],
    payments: () => ['portal', 'payments'],
  },
}
