import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { MoreHorizontal, Pencil, Plus, Search, Tag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ColorPicker } from '@/components/ColorPicker'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { IconButton } from '@/components/IconButton'
import { PageHeader } from '@/components/PageHeader'
import { SettingsCard, SettingsPage, SettingsSection } from '@/components/SettingsPage'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext'
import { useCreateLabel, useDeleteLabel, useUpdateLabel } from '@/hooks/useWorkspaceSettings'
import { ApiError } from '@/lib/api-client'
import { toastApiError } from '@/lib/error-handler'
import { COLOR_PALETTE, labelSchema } from '@/features/workspaces/workspace-schemas'
import type { Label } from '@/types/label'

/** Settings › Labels (WS-6): create, rename, recolor and delete workspace labels. */
export const Route = createFileRoute('/_authed/$workspaceKey/settings/labels')({
  component: LabelsSettings,
})

function LabelsSettings() {
  const { workspace, labels } = useCurrentWorkspace()
  const createLabel = useCreateLabel(workspace.id)
  const updateLabel = useUpdateLabel()
  const deleteLabel = useDeleteLabel()
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Label | null>(null)
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? labels.filter(label => label.name.toLowerCase().includes(term)) : labels
  }, [labels, search])

  const onCreate = async (name: string, color: string) => {
    await createLabel.mutateAsync({ name, color })
    toast.success(`Label ${name} created`)
    setCreating(false)
  }

  const onUpdate = async (label: Label, name: string, color: string) => {
    await updateLabel.mutateAsync({ labelId: label.id, name, color })
    setEditingId(null)
  }

  const onDelete = async () => {
    if (!toDelete) return
    try {
      await deleteLabel.mutateAsync(toDelete.id)
      toast.success(`Label ${toDelete.name} deleted`)
    } catch (error) {
      toastApiError(error, 'Could not delete the label')
    } finally {
      setToDelete(null)
    }
  }

  // A color for the next label that the workspace does not use yet.
  const nextColor =
    COLOR_PALETTE.find(color => !labels.some(label => label.color === color)) ?? COLOR_PALETTE[0]

  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Settings' }]} title="Labels" />
      <SettingsPage
        title="Labels"
        description="Labels group issues across all teams of the workspace."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditingId(null)
              setCreating(true)
            }}
          >
            <Plus />
            New label
          </Button>
        }
      >
        <SettingsSection
          title={`${labels.length} ${labels.length === 1 ? 'label' : 'labels'}`}
          actions={
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-text-tertiary" />
              <Input
                aria-label="Search labels"
                placeholder="Filter labels"
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="h-7 w-48 pl-7 text-mini"
              />
            </div>
          }
        >
          {visible.length === 0 && !creating ? (
            <EmptyState
              icon={<Tag />}
              title={labels.length === 0 ? 'No labels yet' : 'No labels found'}
              description={
                labels.length === 0
                  ? 'Create a label to group issues by area or kind.'
                  : 'No label matches your filter.'
              }
            />
          ) : (
            <SettingsCard role="list" aria-label="Labels">
              {creating ? (
                <LabelEditor
                  initialName=""
                  initialColor={nextColor}
                  submitLabel="Create label"
                  onCancel={() => setCreating(false)}
                  onSubmit={onCreate}
                />
              ) : null}
              {visible.map(label =>
                editingId === label.id ? (
                  <LabelEditor
                    key={label.id}
                    initialName={label.name}
                    initialColor={label.color}
                    submitLabel="Save"
                    onCancel={() => setEditingId(null)}
                    onSubmit={(name, color) => onUpdate(label, name, color)}
                  />
                ) : (
                  <div
                    key={label.id}
                    role="listitem"
                    aria-label={label.name}
                    className="group flex h-11 items-center gap-3 px-4 hover:bg-surface-hover"
                  >
                    <ColorPicker
                      label={`Color of ${label.name}`}
                      value={label.color}
                      onChange={color =>
                        void updateLabel
                          .mutateAsync({ labelId: label.id, color })
                          .catch(error => toastApiError(error, 'Could not change the color'))
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-ui text-foreground">
                      {label.name}
                    </span>
                    <IconButton
                      label={`Edit ${label.name}`}
                      icon={<Pencil />}
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => {
                        setCreating(false)
                        setEditingId(label.id)
                      }}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          label={`Actions for ${label.name}`}
                          icon={<MoreHorizontal />}
                          size="sm"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setCreating(false)
                            setEditingId(label.id)
                          }}
                        >
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(label)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              )}
            </SettingsCard>
          )}
        </SettingsSection>
      </SettingsPage>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={open => {
          if (!open) setToDelete(null)
        }}
        title={`Delete label ${toDelete?.name ?? ''}?`}
        description="The label is removed from every issue that has it."
        confirmLabel="Delete label"
        onConfirm={onDelete}
        pending={deleteLabel.isPending}
      />
    </>
  )
}

interface LabelEditorProps {
  initialName: string
  initialColor: string
  submitLabel: string
  onCancel: () => void
  /** Rejects with the API error; the editor shows it. */
  onSubmit: (name: string, color: string) => Promise<void>
}

/** Inline row to create or edit a label: color swatch + name + buttons. */
function LabelEditor({
  initialName,
  initialColor,
  submitLabel,
  onCancel,
  onSubmit,
}: LabelEditorProps) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Focus the name when the row opens.
  useEffect(() => inputRef.current?.focus(), [])

  const submit = async () => {
    const parsed = labelSchema.safeParse({ name, color })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid label')
      return
    }
    setPending(true)
    try {
      await onSubmit(parsed.data.name, parsed.data.color)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'duplicate_item') {
        setError('A label with this name already exists')
      } else {
        toastApiError(err, 'Could not save the label')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      role="listitem"
      aria-label={initialName ? `Edit ${initialName}` : 'New label'}
      className="flex flex-col gap-1 bg-surface-hover/50 px-4 py-2"
      onSubmit={event => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="flex items-center gap-3">
        <ColorPicker label="Label color" value={color} onChange={setColor} />
        <Input
          aria-label="Label name"
          aria-invalid={error ? true : undefined}
          ref={inputRef}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onCancel()
            }
          }}
          placeholder="Label name"
          value={name}
          onChange={event => {
            setName(event.target.value)
            setError(null)
          }}
          className="h-7 flex-1"
        />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="pl-10 text-mini text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  )
}
