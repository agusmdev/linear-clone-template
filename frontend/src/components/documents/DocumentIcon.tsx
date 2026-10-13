import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocumentIconProps {
  /** The emoji of the document, or null for the default page icon. */
  icon: string | null | undefined
  className?: string
  /** Size of the default icon / emoji box in px. */
  size?: number
}

/** The icon of a document: its emoji, or a muted page glyph. Decorative. */
export function DocumentIcon({ icon, className, size = 16 }: DocumentIconProps) {
  if (icon) {
    return (
      <span
        aria-hidden
        className={cn('inline-flex shrink-0 items-center justify-center leading-none', className)}
        style={{ width: size, height: size, fontSize: size * 0.9 }}
      >
        {icon}
      </span>
    )
  }
  return (
    <FileText
      aria-hidden
      className={cn('shrink-0 text-text-secondary', className)}
      style={{ width: size, height: size }}
    />
  )
}
