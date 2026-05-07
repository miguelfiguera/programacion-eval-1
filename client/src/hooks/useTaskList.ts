import { useCallback, useEffect, useState, type FormEvent } from 'react'

import {
  createTask,
  deleteTask,
  fetchTasks,
  patchTaskDone,
} from '@/lib/api/backend'
import type { TaskRowDto } from '@/lib/api/dto'

/**
 * Encapsulates all task list state transitions and backend calls.
 * @returns Props bag for a presentational task board — no JSX here.
 */
export function useTaskList() {
  const [tasks, setTasks] = useState<TaskRowDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const rows = await fetchTasks()
      setTasks(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setTasks([])
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      await load()
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await createTask(t)
      setTitle('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleDone = async (task: TaskRowDto) => {
    setError(null)
    try {
      await patchTaskDone(task.id, !task.done)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const removeTask = async (id: number) => {
    setError(null)
    try {
      await deleteTask(id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return {
    tasks,
    loading,
    error,
    title,
    setTitle,
    submitting,
    handleAdd,
    toggleDone,
    removeTask,
  }
}
