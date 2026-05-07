import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )

/** Top navigation between app sections (CRUD, exercises, API). */
export function AppNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav
        className="mx-auto flex h-14 max-w-5xl flex-wrap items-center gap-1 px-4"
        aria-label="Principal"
      >
        <span className="mr-2 text-sm font-semibold text-foreground">
          Eval app
        </span>
        <NavLink to="/" end className={navLinkClass}>
          Inicio
        </NavLink>
        <NavLink to="/animal-favorito" className={navLinkClass}>
          Animal favorito
        </NavLink>
        <NavLink to="/exercise-2" className={navLinkClass}>
          Películas
        </NavLink>
        <NavLink to="/api-docs" className={navLinkClass}>
          API
        </NavLink>
      </nav>
    </header>
  )
}
