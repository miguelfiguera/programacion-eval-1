import { type FormEvent } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { ApiReferenceView } from '@/components/views/ApiReferenceView'
import { AnimalLookupView } from '@/components/views/AnimalLookupView'
import { Exercise2View } from '@/components/views/Exercise2View'
import { TasksPageView } from '@/components/views/TasksPageView'
import { documentedExpressEndpoints } from '@/lib/api/endpoints.docs'
import { useAnimalLookup } from '@/hooks/useAnimalLookup'
import { useCatOfDay } from '@/hooks/useCatOfDay'
import { useMovieExercise } from '@/hooks/useMovieExercise'
import { useRecentLogs } from '@/hooks/useRecentLogs'
import { useTaskList } from '@/hooks/useTaskList'

function TasksRoute() {
  const t = useTaskList()
  return (
    <TasksPageView
      tasks={t.tasks}
      loading={t.loading}
      error={t.error}
      title={t.title}
      submitting={t.submitting}
      onTitleChange={t.setTitle}
      onSubmit={t.handleAdd}
      onToggleDone={t.toggleDone}
      onRemove={t.removeTask}
    />
  )
}

function Exercise2Route() {
  const m = useMovieExercise()
  return (
    <Exercise2View
      loadingTaxonomy={m.loadingTaxonomy}
      taxonomyError={m.taxonomyError}
      taxonomy={m.taxonomy}
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

function AnimalRoute() {
  const a = useAnimalLookup()
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
        <Route path="/" element={<TasksRoute />} />
        <Route path="/exercise-2" element={<Exercise2Route />} />
        <Route path="/animal-demo" element={<AnimalRoute />} />
        <Route path="/api-docs" element={<ApiDocsRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
