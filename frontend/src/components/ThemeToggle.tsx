import { Moon, Sun } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import { useTheme } from '@/contexts/ThemeContext'

/** Switches between the dark (default) and light theme. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <IconButton
      label={`Switch to ${next} theme`}
      icon={theme === 'dark' ? <Sun /> : <Moon />}
      onClick={toggleTheme}
      className={className}
    />
  )
}
