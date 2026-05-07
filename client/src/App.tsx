import { type FormEvent } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { RedirectToAnimalFavoritoPreserveSearch } from '@/components/routing/LegacyEx1Redirects'
import { ApiReferenceView } from '@/components/views/ApiReferenceView'
import { AnimalLookupView } from '@/components/views/AnimalLookupView'
import { Exercise2View } from '@/components/views/Exercise2View'
import { HomeView } from '@/components/views/HomeView'
import { documentedExpressEndpoints } from '@/lib/api/endpoints.docs'
import { useAnimalLookup } from '@/hooks/useAnimalLookup'
import { useCatOfDay } from '@/hooks/useCatOfDay'
import { useMovieExercise } from '@/hooks/useMovieExercise'
import { useRecentLogs } from '@/hooks/useRecentLogs'

function HomeRoute() {
  return <HomeView />
}

/** animal-favorito: búsqueda + “Gato del día” (`?favorite=` opcional). */
function AnimalFavoritoRoute() {
  const [searchParams] = useSearchParams()
  const favoriteFromUrl = searchParams.get('favorite') ?? ''

  const a = useAnimalLookup({ favoriteFromUrl })
  const c = useCatOfDay()

  const handleSearch = (e: FormEvent) => {
    c.clear()
    void a.search(e)
  }

  const handleGatoDelDia = () => {
    a.clear()
    void c.load()
  }

  return (
    <AnimalLookupView
      name={a.name}
      loading={a.loading}
      loadingPhaseLabel={a.loadingPhaseLabel}
      error={a.error}
      result={a.result}
      onNameChange={a.setName}
      onSearch={handleSearch}
      gatoDelDia={c.data}
      gatoDelDiaLoading={c.loading}
      gatoDelDiaError={c.error}
      onGatoDelDia={handleGatoDelDia}
    />
  )
}

function Exercise2Route() {
  const m = useMovieExercise()
  return (
    <Exercise2View
      enumGenreEntries={m.enumGenreEntries}
      enumCountryEntries={m.enumCountryEntries}
      genre={m.genre}
      country={m.country}
      onGenreChange={m.setGenre}
      onCountryChange={m.setCountry}
      discoverLoading={m.discoverLoading}
      discoverError={m.discoverError}
      movies={m.movies}
      onDiscover={m.discover}
    />
  )
}

function ApiDocsRoute() {
  const logs = useRecentLogs(50)
  return (
    <ApiReferenceView
      endpoints={documentedExpressEndpoints}
      logs={logs.rows}
      logsLoading={logs.loading}
      logsError={logs.error}
      onLogsReload={logs.reload}
    />
  )
}

/** Application shell: routes only — behaviour lives in hooks + view components. */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/animal-favorito" element={<AnimalFavoritoRoute />} />
          <Route
            path="/animal-favorito/result"
            element={<RedirectToAnimalFavoritoPreserveSearch />}
          />
          <Route
            path="/exercise-1"
            element={<RedirectToAnimalFavoritoPreserveSearch />}
          />
          <Route
            path="/exercise-1/result"
            element={<RedirectToAnimalFavoritoPreserveSearch />}
          />
          <Route path="/ex1/animal" element={<Navigate to="/animal-favorito" replace />} />
          <Route
            path="/ex1/animal/result"
            element={<RedirectToAnimalFavoritoPreserveSearch />}
          />
          <Route path="/exercise-2" element={<Exercise2Route />} />
          <Route path="/animal-demo" element={<Navigate to="/animal-favorito" replace />} />
          <Route path="/api-docs" element={<ApiDocsRoute />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
