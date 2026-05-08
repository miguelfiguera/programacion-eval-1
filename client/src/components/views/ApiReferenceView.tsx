import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DocumentedEndpoint } from '@/lib/api/endpoints.docs'
import type { RequestLogRowDto } from '@/lib/api/dto'

/** Props received from the ApiDocsRoute in App.tsx. */
export type ApiReferenceViewProps = {
  /** Statically typed list of Express endpoints to display. */
  endpoints: DocumentedEndpoint[]
  /** Most recent interaction log rows from SQLite. */
  logs: RequestLogRowDto[]
  /** True while the logs are being fetched. */
  logsLoading: boolean
  /** Error from the last failed log fetch, or null. */
  logsError: string | null
  /** Manually re-fetches the logs. */
  onLogsReload: () => void
}

/**
 * API reference view — two cards:
 *   1. Endpoint catalogue: method, path, and description for every route.
 *   2. Live log tail: scrollable list of recent backend interactions from SQLite.
 */
export function ApiReferenceView({
  endpoints,
  logs,
  logsLoading,
  logsError,
  onLogsReload,
}: ApiReferenceViewProps) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Catálogo de API (Node / Express)</CardTitle>
          <CardDescription>
            Tipos en <code className="rounded bg-muted px-1">src/lib/api/endpoints.docs.ts</code> y helpers en{' '}
            <code className="rounded bg-muted px-1">backend.ts</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2">Método</th>
                  <th className="p-2">Ruta</th>
                  <th className="p-2">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((row) => (
                  <tr key={`${row.method}-${row.path}`} className="border-b border-border/60">
                    <td className="p-2 font-mono text-xs">{row.method}</td>
                    <td className="p-2 font-mono text-xs">{row.path}</td>
                    <td className="p-2 text-muted-foreground">
                      {row.description}
                      {row.notes && (
                        <span className="mt-1 block text-xs">
                          Notas: {row.notes}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos logs (SQLite)</CardTitle>
          <CardDescription>
            GET /api/logs/recent — interacciones registradas por los servicios.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <button
            type="button"
            className="h-8 w-fit rounded-lg border border-border px-3 text-sm"
            onClick={onLogsReload}
          >
            Recargar logs
          </button>
          {logsLoading && (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
          {logsError && (
            <p className="text-sm text-destructive">{logsError}</p>
          )}
          {!logsLoading && logs.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin entradas aún.</p>
          )}
          <ul className="max-h-96 space-y-2 overflow-y-auto text-xs">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded border border-border bg-muted/30 p-2 font-mono"
              >
                <div className="text-foreground">
                  #{log.id} {log.created_at} — {log.endpoint}
                </div>
                <div className="text-muted-foreground">
                  payload: {log.request_payload}
                </div>
                {log.error_log && (
                  <div className="text-destructive">error: {log.error_log}</div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
