import { CircleDashed } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const SIZES = {
  xs: 'size-4 text-[8px]',
  sm: 'size-5 text-[9px]',
  md: 'size-6 text-[10px]',
  lg: 'size-8 text-[12px]',
  xl: 'size-12 text-[17px]',
} as const

export type AvatarSize = keyof typeof SIZES

// Calm colors that work on both themes with white text.
const PALETTE = [
  '#5e6ad2',
  '#4cb782',
  '#f2994a',
  '#eb5757',
  '#26b5ce',
  '#b17fea',
  '#e2a90b',
  '#0f7488',
  '#d86ba4',
  '#6b7a8f',
]

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** The first character as the user sees it: a whole emoji, not half of its UTF-16 pair. */
function firstChar(word: string): string {
  return graphemes.segment(word)[Symbol.iterator]().next().value?.segment ?? ''
}

/** Up to two initials: "Ada Lovelace" -> "AL", "ada@example.com" -> "A", "🚀 Rocket" -> "🚀R". */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (name.includes('@') || words.length === 1) return firstChar(words[0]).toUpperCase()
  return (firstChar(words[0]) + firstChar(words[words.length - 1])).toUpperCase()
}

/** A stable color per name, so a user keeps the same color everywhere. */
export function colorFor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

interface UserAvatarProps {
  /** Display name (or email). null/undefined = unassigned: a dashed circle. */
  name?: string | null
  /** Optional image URL; falls back to initials. */
  src?: string | null
  size?: AvatarSize
  className?: string
  /** Show a small presence dot (bottom-right). */
  online?: boolean
}

/** Round avatar with initials on a per-name color, or the "unassigned" dashed circle. */
export function UserAvatar({ name, src, size = 'md', className, online }: UserAvatarProps) {
  if (!name) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center text-text-tertiary',
          SIZES[size],
          className
        )}
        role="img"
        aria-label="Unassigned"
      >
        <CircleDashed className="size-full" strokeWidth={1.5} />
      </span>
    )
  }
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <Avatar className={SIZES[size]}>
        {src ? <AvatarImage src={src} alt={name} /> : null}
        <AvatarFallback
          className="font-semibold text-white"
          style={{ backgroundColor: colorFor(name) }}
          aria-label={name}
          role="img"
        >
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      {online ? (
        <span className="absolute -right-px -bottom-px size-[35%] rounded-full border-2 border-surface bg-[#4cb782]" />
      ) : null}
    </span>
  )
}
