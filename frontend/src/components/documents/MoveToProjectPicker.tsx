import { Box, FolderMinus } from 'lucide-react'
import { PropertyPicker } from '@/components/PropertyPicker'
import { Button } from '@/components/ui/button'

export interface ProjectChoice {
  id: string
  name: string
  icon?: string | null
}

const NO_PROJECT = 'none'

interface MoveToProjectPickerProps {
  projects: ProjectChoice[]
  /** The document's project id, or null. */
  value: string | null
  onChange: (projectId: string | null) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** The document's project chip; opens a searchable list to move the document. */
export function MoveToProjectPicker({
  projects,
  value,
  onChange,
  open,
  onOpenChange,
}: MoveToProjectPickerProps) {
  const current = projects.find(project => project.id === value)
  return (
    <PropertyPicker
      label="Project"
      placeholder="Move to project..."
      align="end"
      open={open}
      onOpenChange={onOpenChange}
      options={[
        {
          value: NO_PROJECT,
          label: 'No project',
          icon: <FolderMinus className="size-3.5 text-text-tertiary" />,
        },
        ...projects.map(project => ({
          value: project.id,
          label: project.name,
          icon: project.icon ? (
            <span aria-hidden className="text-micro leading-none">
              {project.icon}
            </span>
          ) : (
            <Box className="size-3.5 text-text-secondary" />
          ),
        })),
      ]}
      value={value ?? NO_PROJECT}
      onChange={next => onChange(next === NO_PROJECT ? null : next)}
      trigger={
        <Button variant="ghost" size="sm" aria-label="Project">
          <Box className="size-3.5" />
          <span className="hidden max-w-40 truncate md:inline">
            {current?.name ?? 'Add to project'}
          </span>
        </Button>
      }
    />
  )
}
