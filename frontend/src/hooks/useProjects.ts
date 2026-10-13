import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { API, buildProjectsListUrl } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import type { CreateProjectData, Project, ProjectsParams, UpdateProjectData } from '@/types/project'

/** Projects of a workspace (by sort order). Progress changes with issues, so always refetch on mount. */
export function useProjects(workspaceId: string, params?: ProjectsParams) {
  return useQuery({
    queryKey: queryKeys.projects.list(workspaceId, params),
    queryFn: () => api.get<Project[]>(buildProjectsListUrl(workspaceId, params)),
    refetchOnMount: 'always',
  })
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: () => api.get<Project>(API.PROJECTS.DETAIL(projectId)),
    refetchOnMount: 'always',
    retry: false,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProjectData) => api.post<Project>(API.PROJECTS.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    },
  })
}

/** PATCH with an optimistic update of the detail query (rolled back on error). */
export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient()
  const detailKey = queryKeys.projects.detail(projectId)
  return useMutation({
    mutationFn: (data: UpdateProjectData) =>
      api.patch<Project>(API.PROJECTS.DETAIL(projectId), data),
    onMutate: async data => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<Project>(detailKey)
      if (previous) queryClient.setQueryData<Project>(detailKey, { ...previous, ...data })
      return { previous }
    },
    onError: (_error, _data, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous)
    },
    onSuccess: project => {
      queryClient.setQueryData(detailKey, project)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      // A favorite shows the project's name, icon and color (built by the server).
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => api.delete(API.PROJECTS.DETAIL(projectId)),
    onSuccess: () => {
      // Lists only: removing or invalidating the detail query makes the still open
      // project page refetch the deleted project (404) before it navigates away.
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() })
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.all })
      // The favorites list leaves out the deleted project.
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
    },
  })
}
