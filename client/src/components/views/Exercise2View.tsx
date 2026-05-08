import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MovieDiscoverResponseDto } from '@/lib/api/dto'
import { type MovieSortKey, sortMovies } from '@/lib/movie-sort'
import type { MovieCountryIso, MovieGenreTmdb } from '@/lib/types/movie.enums'
import { AlertCircle } from 'lucide-react'

const MOVIE_SORT_LABELS: Record<MovieSortKey, string> = {
  year: 'Año',
  director: 'Director',
  date: 'Fecha de estreno',
  title: 'Título',
}

/** Props received from the Exercise2Route in App.tsx. */
export type Exercise2ViewProps = {
  /** Genre options for the <select>, derived from the MovieGenreTmdb enum. */
  enumGenreEntries: Array<{ id: number; label: string }>
  /** Country options for the <select>, derived from the MovieCountryIso enum. */
  enumCountryEntries: Array<{ code: string; label: string }>
  /** Currently selected genre filter. */
  genre: MovieGenreTmdb
  /** Currently selected country filter. */
  country: MovieCountryIso
  /** Updates the genre selection. */
  onGenreChange: (g: MovieGenreTmdb) => void
  /** Updates the country selection. */
  onCountryChange: (c: MovieCountryIso) => void
  /** True while the TMDB discover request is in flight. */
  discoverLoading: boolean
  /** Error message from the last failed discover request, or null. */
  discoverError: string | null
  /** Discover results (movie list), or null before first search. */
  movies: MovieDiscoverResponseDto | null
  /** Submits the discover form. */
  onDiscover: (e: FormEvent) => void
}

/**
 * Stateless view for Exercise 2 — movie discovery via TMDB.
 *
 * Top card: displays the TypeScript enum values (genre ids + country codes)
 * so the professor can see how enums map to TMDB parameters.
 *
 * Bottom card: genre + country selects, search button, sortable results
 * with poster, title, release date, director, and overview.
 */
export function Exercise2View({
  enumGenreEntries,
  enumCountryEntries,
  genre,
  country,
  onGenreChange,
  onCountryChange,
  discoverLoading,
  discoverError,
  movies,
  onDiscover,
}: Exercise2ViewProps) {
  const [sortBy, setSortBy] = useState<MovieSortKey>('year')
  /** false = descendente (p. ej. año: más reciente primero). */
  const [sortDesc, setSortDesc] = useState(true)

  const sortedMovies = useMemo(() => {
    if (!movies?.results.length) return []
    return sortMovies(movies.results, sortBy, !sortDesc)
  }, [movies, sortBy, sortDesc])

  const selectClassName =
    'h-9 min-w-[10rem] rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Ejercicio 2 — Géneros y países (TypeScript)</CardTitle>
          <CardDescription>
            Enumeraciones en <code className="rounded bg-muted px-1">client/src/lib/types/movie.enums.ts</code> —
            deben coincidir con el servidor para TMDB.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium">MovieGenreTmdb</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {enumGenreEntries.map((g) => (
                <li key={g.id}>
                  <span className="font-mono text-foreground">{g.id}</span> — {g.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-medium">MovieCountryIso</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {enumCountryEntries.map((c) => (
                <li key={c.code}>
                  <span className="font-mono text-foreground">{c.code}</span> —{' '}
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descubrir películas (TMDB vía backend)</CardTitle>
          <CardDescription>
            Necesitas <code className="rounded bg-muted px-1">TMDB_API_KEY</code> en el servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex flex-wrap items-end gap-3" onSubmit={onDiscover}>
            <label className="flex flex-col gap-1 text-sm text-foreground">
              Género
              <select
                className="h-9 min-w-[12rem] rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={genre}
                onChange={(e) =>
                  onGenreChange(Number(e.target.value) as MovieGenreTmdb)
                }
              >
                {enumGenreEntries.map((g) => (
                  <option key={g.id} value={g.id} className="bg-popover text-popover-foreground">
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-foreground">
              País
              <select
                className="h-9 min-w-[12rem] rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={country}
                onChange={(e) =>
                  onCountryChange(e.target.value as MovieCountryIso)
                }
              >
                {enumCountryEntries.map((c) => (
                  <option key={c.code} value={c.code} className="bg-popover text-popover-foreground">
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={discoverLoading}>
              {discoverLoading ? '…' : 'Buscar'}
            </Button>
          </form>

          {discoverError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{discoverError}</AlertDescription>
            </Alert>
          )}

          {movies && movies.results.length === 0 && !discoverLoading && (
            <p className="text-sm text-muted-foreground">
              Sin resultados (¿falta TMDB_API_KEY o no hay coincidencias?).
            </p>
          )}

          {movies && movies.results.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-sm text-foreground">
                  Ordenar por
                  <select
                    className={selectClassName}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as MovieSortKey)}
                  >
                    {(Object.keys(MOVIE_SORT_LABELS) as MovieSortKey[]).map((k) => (
                      <option key={k} value={k} className="bg-popover text-popover-foreground">
                        {MOVIE_SORT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-foreground">
                  Orden
                  <select
                    className={selectClassName}
                    value={sortDesc ? 'desc' : 'asc'}
                    onChange={(e) => setSortDesc(e.target.value === 'desc')}
                  >
                    <option value="desc" className="bg-popover text-popover-foreground">
                      Descendente
                    </option>
                    <option value="asc" className="bg-popover text-popover-foreground">
                      Ascendente
                    </option>
                  </select>
                </label>
              </div>
              <ul className="flex flex-col gap-3">
                {sortedMovies.map((m) => (
                  <li
                    key={m.id || `${m.title}-${m.releaseDate ?? 'x'}`}
                    className="flex gap-4 rounded-lg border border-border p-4"
                  >
                    {m.posterUrl && (
                      <img
                        src={m.posterUrl}
                        alt=""
                        className="h-32 w-[5.5rem] shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="text-base font-medium">{m.title}</p>
                      <p className="text-muted-foreground">
                        {m.releaseDate ?? 'Sin fecha'}
                        {m.director != null && m.director !== '' ? (
                          <>
                            <span className="mx-1.5 text-border">·</span>
                            Director: {m.director}
                          </>
                        ) : null}
                      </p>
                      <p className="mt-2 line-clamp-5 text-muted-foreground">{m.overview}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
