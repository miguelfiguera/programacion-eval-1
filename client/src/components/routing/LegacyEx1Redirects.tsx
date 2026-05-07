import { Navigate, useLocation } from 'react-router-dom'

/** Canonical animal page; keeps `?favorite=` and other query params. */
export function RedirectToAnimalFavoritoPreserveSearch() {
  const { search } = useLocation()
  return <Navigate to={`/animal-favorito${search}`} replace />
}
