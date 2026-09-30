import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/constants/queryKeys'
import { useAppMutation } from '@/hooks/useAppMutation'
import { studentsService } from '@/services/studentsService'

export function useStudentsList(params) {
  return useQuery({
    queryKey: queryKeys.students.list(params),
    queryFn: () => studentsService.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useStudentOptions({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.students.options(),
    queryFn: studentsService.listOptions,
    enabled,
    staleTime: 60_000,
  })
}

export function useStudentTeacherIds(studentId) {
  return useQuery({
    queryKey: queryKeys.students.assignments(studentId),
    queryFn: () => studentsService.getTeacherIds(studentId),
    enabled: Boolean(studentId),
  })
}

export function useSaveStudent({ onSuccess } = {}) {
  return useAppMutation({
    mutationFn: ({ id, values }) => (id ? studentsService.update(id, values) : studentsService.create(values)),
    invalidate: [queryKeys.students.all],
    successMessage: (_data, { id }) => (id ? 'Student updated' : 'Student created'),
    onSuccess,
  })
}

export function useDeleteStudent({ onSuccess } = {}) {
  return useAppMutation({
    mutationFn: (id) => studentsService.remove(id),
    invalidate: [queryKeys.students.all, queryKeys.teachers.all, queryKeys.schedules.all],
    successMessage: 'Student deleted',
    onSuccess,
  })
}

export function useSetStudentTeachers({ onSuccess } = {}) {
  return useAppMutation({
    mutationFn: ({ studentId, teacherIds }) => studentsService.setTeachers(studentId, teacherIds),
    invalidate: [queryKeys.students.all, queryKeys.teachers.all],
    successMessage: 'Teacher assignments saved',
    onSuccess,
  })
}
