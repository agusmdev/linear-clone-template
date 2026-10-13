/** A page of a paginated list endpoint (fastapi-pagination `Page[T]`). */
export interface Page<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}
