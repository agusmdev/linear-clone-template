import { z } from 'zod'
import type { CreateIssueData, IssuePriority } from '@/types/issue'

/** Titles are one line: line breaks (and the spaces around them) become one space. */
export function singleLineTitle(value: string): string {
  return value.replace(/\s*[\r\n\v\f\u0085\u2028\u2029]+\s*/g, ' ')
}

export const createIssueSchema = z.object({
  team_id: z.string().min(1, 'Pick a team'),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(500, 'Title must be 500 characters or less'),
  /** HTML from the rich text editor; '' = empty. */
  description: z.string().max(200_000, 'Description is too long'),
  state_id: z.string().nullable(),
  priority: z.number().int().min(0).max(4),
  assignee_id: z.string().nullable(),
  label_ids: z.array(z.string()).max(50),
  project_id: z.string().nullable(),
  cycle_id: z.string().nullable(),
  parent_id: z.string().nullable(),
  estimate: z.number().int().min(0).max(1000).nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .nullable(),
})

export type CreateIssueFormData = z.infer<typeof createIssueSchema>

/** Form values -> POST /issues body. Empty values are left out (server defaults). */
export function createIssueFormToPayload(data: CreateIssueFormData): CreateIssueData {
  const payload: CreateIssueData = {
    team_id: data.team_id,
    title: singleLineTitle(data.title).trim(),
    priority: data.priority as IssuePriority,
    label_ids: data.label_ids,
  }
  if (data.description.trim()) payload.description = data.description
  if (data.state_id) payload.state_id = data.state_id
  if (data.assignee_id) payload.assignee_id = data.assignee_id
  if (data.project_id) payload.project_id = data.project_id
  if (data.cycle_id) payload.cycle_id = data.cycle_id
  if (data.parent_id) payload.parent_id = data.parent_id
  if (data.estimate !== null) payload.estimate = data.estimate
  if (data.due_date) payload.due_date = data.due_date
  return payload
}
