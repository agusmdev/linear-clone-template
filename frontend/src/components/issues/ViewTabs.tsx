import type { ReactNode } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export interface ViewTab<V extends string> {
  value: V
  label: string
  icon?: ReactNode
}

/**
 * The current tab from the `?tab=` search param (the first tab when missing or
 * unknown). `dropOnSwitch(tab)` names the search keys to remove when switching
 * to `tab` (e.g. filters that do not apply there).
 */
export function useSearchTab<V extends string>(
  tabs: readonly ViewTab<V>[],
  dropOnSwitch?: (tab: V) => readonly string[]
): [V, (tab: V) => void] {
  const navigate = useNavigate()
  const raw = useRouterState({ select: s => (s.location.search as Record<string, unknown>).tab })
  const current = tabs.find(t => t.value === String(raw ?? ''))?.value ?? tabs[0].value
  const setTab = (tab: V) =>
    void navigate({
      to: '.',
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        ...Object.fromEntries((dropOnSwitch?.(tab) ?? []).map(key => [key, undefined])),
        tab: tab === tabs[0].value ? undefined : tab,
      })) as never,
    })
  return [current, setTab]
}

/** Linear's view tabs (All issues / Active / Backlog, Assigned / Created / Subscribed). */
export function ViewTabs<V extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly ViewTab<V>[]
  value: V
  onChange: (value: V) => void
  label: string
}) {
  return (
    <Tabs value={value} onValueChange={next => onChange(next as V)}>
      <TabsList aria-label={label}>
        {tabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.icon}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
