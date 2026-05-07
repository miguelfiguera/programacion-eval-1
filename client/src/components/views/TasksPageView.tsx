import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { TaskRowDto } from '@/lib/api/dto'
import { AlertCircle } from 'lucide-react'

export type TasksPageViewProps = {
  tasks: TaskRowDto[]
  loading: boolean
  error: string | null
  title: string
  submitting: boolean
  onTitleChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  onToggleDone: (task: TaskRowDto) => void
  onRemove: (id: number) => void
}

/** Renders the todo list — all behaviour is injected via props from `useTaskList`. */
export function TasksPageView({
  tasks,
  loading,
  error,
  title,
  submitting,
  onTitleChange,
  onSubmit,
  onToggleDone,
  onRemove,
}: TasksPageViewProps) {
  return (
    <div className="flex min-h-svh flex-col items-center bg-background px-4 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Tasks</CardTitle>
          <CardDescription>
            <Link className="text-primary underline" to="/exercise-2">
              Ejercicio 2 (películas)
            </Link>
            {' · '}
            <Link className="text-primary underline" to="/animal-demo">
              Animal demo
            </Link>
            {' · '}
            <Link className="text-primary underline" to="/api-docs">
              API
            </Link>
            {' · '}
            <a className="text-primary underline" href="/ex1/animal">
              Ej.1 HTML
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form className="flex gap-2" onSubmit={onSubmit}>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="New task…"
              aria-label="Task title"
              autoComplete="off"
              className="flex-1"
            />
            <Button type="submit" disabled={submitting || !title.trim()}>
              Add
            </Button>
          </form>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-card-foreground shadow-sm"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <Checkbox
                      checked={Boolean(task.done)}
                      onCheckedChange={() => onToggleDone(task)}
                    />
                    <span
                      className={
                        task.done
                          ? 'truncate text-muted-foreground line-through'
                          : 'truncate'
                      }
                    >
                      {task.title}
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onRemove(task.id)}
                    aria-label={`Delete ${task.title}`}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
