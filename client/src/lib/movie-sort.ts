import type { MovieSummaryDto } from '@/lib/api/dto'

export type MovieSortKey = 'year' | 'director' | 'date' | 'title'

function releaseYear(iso: string | null): number | null {
  if (!iso || iso.length < 4) return null
  const y = parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

/**
 * Stable sort for movie lists. `ascending` false = newest-first for year/date, Z→A for title/director.
 */
export function compareMovies(
  a: MovieSummaryDto,
  b: MovieSummaryDto,
  key: MovieSortKey,
  ascending: boolean,
): number {
  const inv = ascending ? 1 : -1

  const tieTitle = () => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })

  switch (key) {
    case 'year': {
      const ya = releaseYear(a.releaseDate)
      const yb = releaseYear(b.releaseDate)
      if (ya == null && yb == null) return tieTitle() * inv
      if (ya == null) return 1
      if (yb == null) return -1
      if (ya !== yb) return (ya - yb) * inv
      return tieTitle() * inv
    }
    case 'date': {
      const da = a.releaseDate ?? ''
      const db = b.releaseDate ?? ''
      if (!da && !db) return tieTitle() * inv
      if (!da) return 1
      if (!db) return -1
      if (da !== db) return da.localeCompare(db) * inv
      return tieTitle() * inv
    }
    case 'director': {
      const d1 = (a.director ?? '').toLocaleLowerCase('es')
      const d2 = (b.director ?? '').toLocaleLowerCase('es')
      if (!d1 && !d2) return tieTitle() * inv
      if (!d1) return 1
      if (!d2) return -1
      if (d1 !== d2) return d1.localeCompare(d2, 'es') * inv
      return tieTitle() * inv
    }
    case 'title':
    default:
      return tieTitle() * inv
  }
}

export function sortMovies(
  rows: MovieSummaryDto[],
  key: MovieSortKey,
  ascending: boolean,
): MovieSummaryDto[] {
  const copy = [...rows]
  copy.sort((a, b) => compareMovies(a, b, key, ascending))
  return copy
}
