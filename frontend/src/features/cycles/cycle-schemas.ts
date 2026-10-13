import { z } from 'zod'

const day = z
  .string()
  .min(1, 'Pick a date')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date')

export const cycleSchema = z
  .object({
    name: z.string().trim().max(255, 'Name must be less than 255 characters'),
    starts_at: day,
    ends_at: day,
  })
  .refine(data => data.ends_at > data.starts_at, {
    message: 'The end date must be after the start date',
    path: ['ends_at'],
  })

export type CycleFormData = z.infer<typeof cycleSchema>

/** An empty name is sent as `null`: the cycle is then shown as "Cycle <number>". */
export function cycleFormToPayload(data: CycleFormData) {
  return { name: data.name.trim() || null, starts_at: data.starts_at, ends_at: data.ends_at }
}
