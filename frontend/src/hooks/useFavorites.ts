import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { API } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import type {
  CreateFavoriteData,
  Favorite,
  FavoriteEntityType,
  UpdateFavoriteData,
} from '@/types/favorite'

/** My favorites in the workspace, in sidebar order. */
export function useFavorites(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.favorites.list(workspaceId ?? ''),
    queryFn: () => api.get<Favorite[]>(API.FAVORITES.LIST(workspaceId ?? '')),
    enabled: !!workspaceId,
  })
}

/** The favorite row of one entity, or undefined when it is not a favorite. */
export function useFavoriteOf(
  workspaceId: string,
  entityType: FavoriteEntityType,
  entityId: string
) {
  const query = useFavorites(workspaceId)
  const favorite = query.data?.find(f => f.entity_type === entityType && f.entity_id === entityId)
  return { favorite, isLoading: query.isLoading }
}

export function useAddFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFavoriteData) => api.post<Favorite>(API.FAVORITES.CREATE, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
    },
  })
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (favoriteId: string) => api.delete(API.FAVORITES.DETAIL(favoriteId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
    },
  })
}

/** Move a favorite: PATCH its sort_order (optimistic, so the sidebar does not jump). */
export function useReorderFavorite(workspaceId: string) {
  const queryClient = useQueryClient()
  const listKey = queryKeys.favorites.list(workspaceId)
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFavoriteData }) =>
      api.patch<Favorite>(API.FAVORITES.DETAIL(id), data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData<Favorite[]>(listKey)
      queryClient.setQueryData<Favorite[]>(listKey, old =>
        old
          ?.map(f => (f.id === id ? { ...f, sort_order: data.sort_order } : f))
          .sort((a, b) => a.sort_order - b.sort_order)
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
    },
  })
}

/** In-app path of a favorite's entity under the workspace base path (e.g. `/acme`). */
export function favoritePath(base: string, favorite: Favorite): string {
  switch (favorite.entity_type) {
    case 'issue':
      return `${base}/issue/${favorite.identifier ?? favorite.entity_id}`
    case 'project':
      return `${base}/project/${favorite.entity_id}`
    case 'document':
      return `${base}/document/${favorite.entity_id}`
    case 'team':
      return `${base}/team/${favorite.identifier ?? ''}/issues`
  }
}
