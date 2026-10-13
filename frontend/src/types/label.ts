export interface LabelSummary {
  id: string
  name: string
  color: string
}

export interface Label extends LabelSummary {
  workspace_id: string
  created_at: string
  updated_at: string
}

/** Planned: POST /workspaces/{id}/labels, PATCH /labels/{id} (see docs/API.md). */
export interface CreateLabelData {
  name: string
  color: string
}

export type UpdateLabelData = Partial<CreateLabelData>
