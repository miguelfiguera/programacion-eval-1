import { useCallback, useEffect, useState, type FormEvent } from 'react'
import './App.css'

type Task = {
  id: number
  title: string
  done: number | boolean
  created_at: string
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    return data.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const res = await fetch('/api/tasks')
    if (!res.ok) {
      setError(await parseError(res))
      setTasks([])
      return
    }
    setTasks((await res.json()) as Task[])
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

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t || submitting) return
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t }),
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(await parseError(res))
      return
    }
    setTitle('')
    await load()
  }

  async function toggleDone(task: Task) {
    setError(null)
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !task.done }),
    })
    if (!res.ok) {
      setError(await parseError(res))
      return
    }
    await load()
  }

  async function removeTask(id: number) {
    setError(null)
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 204) {
      setError(await parseError(res))
      return
    }
    await load()
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Tasks</h1>
        <p className="subtitle">Express · SQLite · React · TypeScript</p>
      </header>

      {error && (
        <div className="banner error" role="alert">
          {error}
        </div>
      )}

      <form className="add-form" onSubmit={handleAdd}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task…"
          aria-label="Task title"
          autoComplete="off"
        />
        <button type="submit" disabled={submitting || !title.trim()}>
          Add
        </button>
      </form>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="muted">No tasks yet. Add one above.</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={task.done ? 'task done' : 'task'}>
              <label className="task-label">
                <input
                  type="checkbox"
                  checked={Boolean(task.done)}
                  onChange={() => {
                    void toggleDone(task)
                  }}
                />
                <span className="task-title">{task.title}</span>
              </label>
              <button
                type="button"
                className="delete"
                onClick={() => {
                  void removeTask(task.id)
                }}
                aria-label={`Delete ${task.title}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
