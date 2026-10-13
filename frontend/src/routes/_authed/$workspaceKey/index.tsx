import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/<ws>` opens the workspace's home page: My issues. */
export const Route = createFileRoute('/_authed/$workspaceKey/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: `/${params.workspaceKey}/my-issues` as '/', replace: true })
  },
})
