import { z } from 'zod'

/** Same rule as the backend: lowercase letters, digits and single dashes, 2-48 chars. */
export const URL_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** 2-5 uppercase letters: the issue prefix (ENG-12). */
export const TEAM_KEY_PATTERN = /^[A-Z]{2,5}$/
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

/** Linear's picker palette (labels, teams, workflow states). */
export const COLOR_PALETTE = [
  '#95a2b3',
  '#5e6ad2',
  '#26b5ce',
  '#4cb782',
  '#f2c94c',
  '#f2994a',
  '#f7c8c1',
  '#eb5757',
  '#bb87fc',
  '#4ea7fc',
] as const

/** "Acme Inc." -> "acme-inc": the URL key suggested for a workspace name. */
export function deriveUrlKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
}

/** "Engineering" -> "ENG": the team key suggested for a team name. */
export function deriveTeamKey(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, '').toUpperCase()
  return letters.length >= 2 ? letters.slice(0, 3) : ''
}

const urlKey = z
  .string()
  .min(2, 'The URL must have at least 2 characters')
  .max(48, 'The URL can have at most 48 characters')
  .regex(URL_KEY_PATTERN, 'Use lowercase letters, numbers and dashes only')

export const workspaceSchema = z.object({
  name: z.string().trim().min(1, 'Workspace name is required').max(255),
  url_key: urlKey,
})
export type WorkspaceFormData = z.infer<typeof workspaceSchema>

export const inviteSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.enum(['admin', 'member']),
})
export type InviteFormData = z.infer<typeof inviteSchema>

export const teamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(255),
  key: z.string().regex(TEAM_KEY_PATTERN, 'Use 2 to 5 uppercase letters (A-Z)'),
  description: z.string().max(10000).optional(),
  color: z.string().regex(HEX_COLOR_PATTERN),
})
export type TeamFormData = z.infer<typeof teamSchema>

export const labelSchema = z.object({
  name: z.string().trim().min(1, 'Label name is required').max(255),
  color: z.string().regex(HEX_COLOR_PATTERN, 'Pick a color'),
})
export type LabelFormData = z.infer<typeof labelSchema>

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'Name is required').max(255),
})
export type ProfileFormData = z.infer<typeof profileSchema>
