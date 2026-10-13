import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { API, buildDocumentsListUrl } from '@/lib/api-endpoints'
import { queryKeys } from '@/lib/query-keys'
import type {
  CreateDocumentData,
  Document,
  DocumentSummary,
  DocumentsParams,
  UpdateDocumentData,
} from '@/types/document'
import type { Page } from '@/types/page'

const PAGE_SIZE = 100
/** Safety cap: 20 pages of 100 documents. */
const MAX_PAGES = 20

/** Every page of GET /documents for `params`, flattened. */
async function fetchAllDocuments(params: DocumentsParams): Promise<DocumentSummary[]> {
  const items: DocumentSummary[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await api.get<Page<DocumentSummary>>(
      buildDocumentsListUrl({ ...params, page, size: PAGE_SIZE })
    )
    items.push(...result.items)
    if (page >= result.pages) break
  }
  return items
}

/** GET /documents: every page of a workspace's documents (default: newest edit first). */
export function useDocuments(params: DocumentsParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.documents.list(params),
    queryFn: () => fetchAllDocuments(params),
    enabled,
    // Keep the current rows while a new search loads (no flicker, no focus loss).
    placeholderData: keepPreviousData,
  })
}

export function useDocument(documentId: string) {
  return useQuery({
    queryKey: queryKeys.documents.detail(documentId),
    queryFn: () => api.get<Document>(API.DOCUMENTS.DETAIL(documentId)),
    retry: false,
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDocumentData) => api.post<Document>(API.DOCUMENTS.CREATE, data),
    onSuccess: document => {
      queryClient.setQueryData(queryKeys.documents.detail(document.id), document)
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() })
    },
  })
}

/**
 * PATCH /documents/{id}. The detail cache gets the response directly (no
 * refetch), so the editor that is open is never reset while the user types.
 */
export interface UpdateDocumentVariables {
  data: UpdateDocumentData
  /** Set when the page is being reloaded or closed, so the save is not cancelled. */
  keepalive?: boolean
}

export function useUpdateDocument(documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ data, keepalive }: UpdateDocumentVariables) =>
      api.patch<Document>(API.DOCUMENTS.DETAIL(documentId), data, { keepalive }),
    onSuccess: document => {
      queryClient.setQueryData(queryKeys.documents.detail(documentId), document)
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() })
      // A favorite shows the document's title and emoji (built by the server).
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
    },
  })
}

export function useDeleteDocument(documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete(API.DOCUMENTS.DETAIL(documentId)),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.documents.detail(documentId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.lists() })
      // The server deletes the document's favorites too.
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all })
    },
  })
}
