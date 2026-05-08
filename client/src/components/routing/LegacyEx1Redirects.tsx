import { Navigate, useLocation } from 'react-router-dom'

/**
 * Redirects old exercise-1 paths to the canonical `/animal-favorito` route.
 * Preserves query parameters (e.g. `?favorite=lion`) so bookmarked links
 * from previous versions still work.
 */
export function RedirectToAnimalFavoritoPreserveSearch() {
  const { search } = useLocation()
  return <Navigate to={`/animal-favorito${search}`} replace />
}
