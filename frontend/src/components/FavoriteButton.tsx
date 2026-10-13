import { Star } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useAddFavorite, useFavoriteOf, useRemoveFavorite } from '@/hooks/useFavorites'
import { toastApiError } from '@/lib/error-handler'
import { cn } from '@/lib/utils'
import type { FavoriteEntityType } from '@/types/favorite'

interface FavoriteButtonProps {
  entityType: FavoriteEntityType
  entityId: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Star toggle: adds the entity to (or removes it from) my sidebar favorites.
 * Use it under routes/_authed/$workspaceKey (it reads the current workspace).
 */
export function FavoriteButton({
  entityType,
  entityId,
  size = 'md',
  className,
}: FavoriteButtonProps) {
  const { workspace } = useCurrentWorkspace()
  const { favorite, isLoading } = useFavoriteOf(workspace.id, entityType, entityId)
  const add = useAddFavorite()
  const remove = useRemoveFavorite()
  const pending = isLoading || add.isPending || remove.isPending
  const isFavorite = !!favorite

  const toggle = () => {
    if (favorite) {
      remove.mutate(favorite.id, {
        onError: error => toastApiError(error, 'Could not remove favorite'),
      })
    } else {
      add.mutate(
        { workspace_id: workspace.id, entity_type: entityType, entity_id: entityId },
        { onError: error => toastApiError(error, 'Could not add favorite') }
      )
    }
  }

  return (
    <IconButton
      label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      icon={<Star className={cn(isFavorite && 'fill-chart-3 text-chart-3')} />}
      size={size}
      active={isFavorite}
      aria-pressed={isFavorite}
      disabled={pending}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        toggle()
      }}
      className={className}
    />
  )
}
