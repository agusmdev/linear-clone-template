import { z } from 'zod'
import type { CreateProjectData, ProjectStatus } from '@/types/project'

const STATUSES = [
  'planned',
  'started',
  'paused',
  'completed',
  'canceled',
] as const satisfies readonly ProjectStatus[]

export const projectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Project name is required')
      .max(255, 'Project name must be less than 255 characters'),
    description: z.string(),
    status: z.enum(STATUSES),
    lead_id: z.string().nullable(),
    start_date: z.string().nullable(),
    target_date: z.string().nullable(),
    team_ids: z.array(z.string()),
    icon: z.string(),
    color: z.string(),
  })
  .refine(data => !data.start_date || !data.target_date || data.start_date <= data.target_date, {
    message: 'The target date must be after the start date',
    path: ['target_date'],
  })

export type ProjectFormData = z.infer<typeof projectSchema>

/** Form values -> POST /projects body. An empty description is sent as null. */
export function projectFormToPayload(
  workspaceId: string,
  data: ProjectFormData
): CreateProjectData {
  return {
    workspace_id: workspaceId,
    name: data.name.trim(),
    description: data.description || null,
    status: data.status,
    lead_id: data.lead_id,
    start_date: data.start_date,
    target_date: data.target_date,
    team_ids: data.team_ids,
    icon: data.icon,
    color: data.color,
  }
}
