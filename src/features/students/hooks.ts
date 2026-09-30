import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { useAppMutation, type MutationHookOptions } from '@/hooks/useAppMutation'
import type { StudentValues } from '@/schemas/student'
import { studentsService, type StudentListParams } from '@/services/studentsService'

export function useStudentsList(params: StudentListParams) {
  return useQuery({
    queryKey: queryKeys.students.list(params),
    queryFn: () => studentsService.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useStudentOptions({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.students.options(),
    queryFn: studentsService.listOptions,
    enabled,
    staleTime: 60_000,
  })
}

export function useStudentTeacherIds(studentId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.students.assignments(studentId),
    queryFn: () => studentsService.getTeacherIds(studentId!),
    enabled: Boolean(studentId),
  })
}

export function useSaveStudent({ onSuccess }: MutationHookOptions = {}) {
  return useAppMutation({
    mutationFn: ({ id, values }: { id?: string; values: StudentValues }) =>
      id ? studentsService.update(id, values) : studentsService.create(values),
    invalidate: [queryKeys.students.all],
    successMessage: (_data, { id }) => (id ? 'Student updated' : 'Student created'),
    onSuccess,
  })
}

export function useDeleteStudent({ onSuccess }: MutationHookOptions = {}) {
  return useAppMutation({
    mutationFn: (id: string) => studentsService.remove(id),
    invalidate: [queryKeys.students.all, queryKeys.teachers.all, queryKeys.schedules.all],
    successMessage: 'Student deleted',
    onSuccess,
  })
}

export function useSetStudentTeachers({ onSuccess }: MutationHookOptions = {}) {
  return useAppMutation({
    mutationFn: ({ studentId, teacherIds }: { studentId: string; teacherIds: string[] }) =>
      studentsService.setTeachers(studentId, teacherIds),
    invalidate: [queryKeys.students.all, queryKeys.teachers.all],
    successMessage: 'Teacher assignments saved',
    onSuccess,
  })
}
