/**
 * Pure heuristic helpers for the animal-lookup pipeline.
 * No I/O, no side-effects — easy to test.
 */

// ── query normalisation ─────────────────────────────────────────────

/** Trim, strip combining marks (accents), lowercase. */
export function foldQuery(raw: string): string {
  return raw
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Deduplicate titles by their folded form; first occurrence wins. */
export function dedupeTitlesByFold(titles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of titles) {
    const t = raw.trim();
    if (!t) continue;
    const key = foldQuery(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Deduplicate Wikidata Q-ids; first occurrence wins. */
export function dedupeQids(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id?.startsWith("Q") || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

// ── known-bad queries ───────────────────────────────────────────────

/** Queries that are clearly not animals (plants, drugs, etc.). */
export const NON_ANIMAL_QUERIES = new Set([
  "alcohol",
  "arabica",
  "cacao",
  "cannabis",
  "coca",
  "cocaina",
  "cocaine",
  "hemp",
  "heroin",
  "heroina",
  "indica",
  "marihuana",
  "marijuana",
  "nicotina",
  "nicotine",
  "opio",
  "opium",
  "papaver",
  "sativa",
  "tabacum",
  "tabaco",
  "tobacco",
]);

// ── hint titles ─────────────────────────────────────────────────────

/**
 * When OpenSearch ranks cities/people first for a Spanish common name,
 * these English titles are tried before the search results.
 */
export const TITLE_HINTS: Record<string, string[]> = {
  leon: ["Lion"],
  leona: ["Lion"],
  tigre: ["Tiger"],
  gata: ["Cat"],
  gato: ["Cat"],
  perro: ["Dog"],
  oso: ["Bear"],
  lobo: ["Wolf"],
  lupus: ["Wolf"],
  zorra: ["Fox"],
  zorro: ["Fox"],
  elefante: ["Elephant"],
  jirafa: ["Giraffe"],
  cebra: ["Zebra"],
  mono: ["Monkey"],
};

// ── title-level filters ─────────────────────────────────────────────

/** Titles that are plants/drugs often confused with animal names. */
const EXCLUDED_TITLES = new Set(["khat", "catha edulis", "catha", "qat"]);

export function titleIsExcludedNonAnimal(title: string): boolean {
  const t = foldQuery(title.replace(/_/g, " ").replace(/\([^)]*\)/g, " ").trim());
  return EXCLUDED_TITLES.has(t);
}

export function titleLooksAstronomy(title: string): boolean {
  const t = foldQuery(title.replace(/_/g, " "));
  return /\b(constellation|constelacion|asterism|asterismo|messier|zodiac)\b/.test(t)
    || /\((constellation|asterism)\)/.test(t)
    || (t.includes("iau") && /\b(constellation|asterism)\b/.test(t));
}

/** True when a title should be skipped (astronomy or excluded non-animal). */
export function titleShouldSkip(title: string): boolean {
  return titleLooksAstronomy(title) || titleIsExcludedNonAnimal(title);
}

// ── category-level filters ──────────────────────────────────────────

function categoryBlobMatches(categories: string[], patterns: RegExp[]): boolean {
  const blob = categories.join(" | ").toLowerCase();
  return patterns.some((p) => p.test(blob));
}

const PLANT_PATTERNS: RegExp[] = [
  /\bplantae\b/, /\bplants?\b/, /\bfungi\b/, /\bbotan/i, /\bflora\b/,
  /\bherbs?\b/, /\bvegetables?\b/, /\bflowers?\b/, /\balgae\b/, /\brosales\b/,
  /\bcannabis\b/, /\bcrops?\b/, /\bkhat\b/, /\bcatha\b/, /\bcathinone\b/,
  /\balkaloids?\b/, /\bstimulants?\b/, /\bpsychoactive\b/, /\bentheogens?\b/,
  /\btrees?\b/, /\bshrubs?\b/, /\bfruits?\b/, /\bdioecious\b/,
  /\bevergreen\b/, /\bdeciduous\b/, /\bpoales\b/, /\basteraceae\b/,
];

const PERSON_PATTERNS: RegExp[] = [
  /\bliving people\b/, /\bdead people\b/, /\bdeaths in \d/, /\bbirths in \d/,
  /\bnacidos en \d/, /\bfallecidos en \d/, /\bmale film actors\b/,
  /\bamerican male film actors\b/, /\bactress(?:es)?\b/, /\bactors\b/,
  /\bactores\b/, /\bactrices\b/, /\bpolitic(?:os|al|ians?)\b/,
  /\bmusicians\b/, /\bmúsicos\b/, /\bfilm directors\b/,
  /\bdirector(?:es)? de cine\b/, /\bsportspeople\b/, /\bdeportistas\b/,
];

const ASTRONOMY_PATTERNS: RegExp[] = [
  /\bconstellations?\b/, /\bconstelaciones?\b/, /\basterisms?\b/,
  /\b(open|globular)\s+clusters?\b/, /\bgalaxies\b/, /\bgalaxias\b/,
  /\bdwarf\s+planets?\b/, /\bplanetary\s+nebulae\b/, /\bnebulosae?\b/,
  /\bnebrosas?\b/, /\bdee?p[\s-]sky\b/, /\bastro?nom(y|ia|ical|i[ck]e)\b/,
  /\bcelestial\b/, /\bmessier\s+objects?\b/,
];

export function categoriesLookNonAnimal(cats: string[]): boolean {
  return categoryBlobMatches(cats, PLANT_PATTERNS);
}

export function categoriesLookPerson(cats: string[]): boolean {
  return categoryBlobMatches(cats, PERSON_PATTERNS);
}

export function categoriesLookAstronomy(cats: string[]): boolean {
  return categoryBlobMatches(cats, ASTRONOMY_PATTERNS);
}

/** True if Wikipedia categories suggest this is NOT an animal article. */
export function categoriesShouldSkip(cats: string[]): boolean {
  return categoriesLookNonAnimal(cats)
    || categoriesLookPerson(cats)
    || categoriesLookAstronomy(cats);
}
