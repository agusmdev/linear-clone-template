import React, { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

/** localStorage key of the chosen theme. The inline script in __root.tsx reads it too. */
export const THEME_STORAGE_KEY = 'theme'
const DEFAULT_THEME: Theme = 'dark'

/**
 * Runs in <head> before the first paint: puts the stored theme class on <html>,
 * so a light-theme user never sees a dark flash. Keep it in sync with applyTheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light')t='dark';var c=document.documentElement.classList;c.remove('dark','light');c.add(t);}catch(e){}})()`

const listeners = new Set<() => void>()

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function applyTheme(theme: Theme) {
  const classes = document.documentElement.classList
  classes.remove('dark', 'light')
  classes.add(theme)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changed the theme.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    applyTheme(readTheme())
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

// The server cannot read localStorage: it renders the default theme.
const getServerTheme = (): Theme => DEFAULT_THEME

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerTheme)

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage blocked (private mode): the theme still changes for this page.
    }
    applyTheme(next)
    listeners.forEach(listener => listener())
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(readTheme() === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
