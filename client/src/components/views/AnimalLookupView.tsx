import type { FormEvent } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AnimalLookupResultDto, CatOfDayDto } from '@/lib/api/dto'
import { AlertCircle, Loader2 } from 'lucide-react'

export type AnimalLookupViewProps = {
  name: string
  loading: boolean
  /** Progreso aproximado mientras el backend trabaja (Wikidata → Animalia → imágenes). */
  loadingPhaseLabel: string | null
  error: string | null
  result: AnimalLookupResultDto | null
  onNameChange: (v: string) => void
  onSearch: (e: FormEvent) => void
  gatoDelDia: CatOfDayDto | null
  gatoDelDiaLoading: boolean
  gatoDelDiaError: string | null
  onGatoDelDia: () => void
}

/** Stateless layout for animal-favorito: Wikipedia / TheCatAPI lookup + “Gato del día”. */
export function AnimalLookupView({
  name,
  loading,
  loadingPhaseLabel,
  error,
  result,
  onNameChange,
  onSearch,
  gatoDelDia,
  gatoDelDiaLoading,
  gatoDelDiaError,
  onGatoDelDia,
}: AnimalLookupViewProps) {
  return (
    <div className="flex flex-col items-center px-4 py-8">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-mono">animal-favorito</CardTitle>
          <CardDescription>
            Busca un animal: el backend consulta Wikipedia y, si hace falta,{' '}
            <a
              className="text-primary underline"
              href="https://thecatapi.com/"
              target="_blank"
              rel="noreferrer"
            >
              TheCatAPI
            </a>
            . “Gato del día” combina imagen (TheCatAPI) y un dato vía{' '}
            <a
              className="text-primary underline"
              href="https://catfact.ninja/"
              target="_blank"
              rel="noreferrer"
            >
              CatFact.ninja
            </a>{' '}
            (gratis, texto en inglés).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {gatoDelDiaError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{gatoDelDiaError}</AlertDescription>
            </Alert>
          )}

          <form
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch"
            onSubmit={onSearch}
          >
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Nombre del animal…"
              autoComplete="off"
              className="min-w-0 sm:min-w-[12rem] sm:flex-1"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || !name.trim()}>
                Buscar
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={loading || gatoDelDiaLoading}
                onClick={onGatoDelDia}
              >
                Gato del día
              </Button>
            </div>
          </form>

          {loading && (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 py-10 text-muted-foreground"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2 className="size-9 animate-spin text-primary" aria-hidden />
              <span className="text-center text-sm font-medium leading-snug text-foreground">
                {loadingPhaseLabel ?? 'Preparando búsqueda…'}
              </span>
              <span className="max-w-xs text-center text-xs text-muted-foreground">
                El texto de cada paso es aproximado en el tiempo; el servidor solo devuelve un resultado
                cuando Wikidata confirma Animalia (o el mismo criterio en el respaldo Wikipedia).
              </span>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Búsqueda
              </p>
              <p className="font-medium">{result.displayName}</p>
              {result.message && (
                <p className="text-sm text-muted-foreground">{result.message}</p>
              )}
              {result.imageUrl ? (
                <img
                  src={result.imageUrl}
                  alt={result.displayName}
                  className="max-h-80 w-full rounded-lg object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Sin imagen.</p>
              )}
              {result.wikipediaUrl && (
                <p className="text-sm">
                  <a
                    href={result.wikipediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {result.wikipediaUrl.includes("wikidata.org")
                      ? "Ver entrada en Wikidata"
                      : "Ver artículo en Wikipedia"}
                  </a>
                </p>
              )}
            </div>
          )}

          {(gatoDelDiaLoading || gatoDelDia) && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Gato del día
              </p>
              {gatoDelDiaLoading && (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              )}
              {gatoDelDia && (
                <>
                  <blockquote className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-muted-foreground italic md:text-base">
                    “{gatoDelDia.quote}”
                  </blockquote>
                  {gatoDelDia.imageUrl ? (
                    <img
                      src={gatoDelDia.imageUrl}
                      alt="Gato del día"
                      className="max-h-80 w-full rounded-lg object-contain"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin imagen.</p>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
