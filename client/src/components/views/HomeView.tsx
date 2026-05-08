import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Landing page view.
 * Shows a welcome card pointing the user to the nav sections:
 * animal-favorito, movies, and API reference.
 */
export function HomeView() {
  return (
    <div className="flex flex-col items-center px-4 py-12">
      <Card className="w-full max-w-md text-center shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Inicio</CardTitle>
          <CardDescription>
            Elige un apartado en la barra superior: <span className="font-mono text-foreground">animal-favorito</span>, Películas o la
            referencia de API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Toda la interfaz es React; el servidor en el puerto 3001 solo expone JSON bajo{' '}
            <code className="rounded bg-muted px-1">/api</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
