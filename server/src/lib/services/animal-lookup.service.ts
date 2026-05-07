import type { AnimalLookupResult } from "../../types/animal.types.js";
import { fetchRandomCatImageUrl } from "./cat-api.service.js";
import { recordServiceInteraction } from "./request-log.service.js";
import {
  type WikidataEntity,
  wikidataEntityP31BlockedForAnimalLookup,
  wikipediaArticleIsAnimalTaxon,
  wikidataGetEntitiesClaimsAndSitelinks,
  wikidataItemIsUnderAnimalia,
  wikidataP18Filename,
  wikidataSearchEntityIds,
  wikidataSitelinkArticleTitle,
} from "./wikidata-animal.service.js";
import { fetchWithWikimediaRetry } from "../wikimedia-http.js";

const WIKI_ORIGINS = {
  en: "https://en.wikipedia.org",
  es: "https://es.wikipedia.org",
} as const;

type WikiLang = keyof typeof WIKI_ORIGINS;

/** Wikidata graph walk can be slow; treat as inconclusive (null) so Wikipedia can still be used. */
const WIKIDATA_ANIMAL_CHECK_BUDGET_MS = 8500;

/** OpenSearch titles to pull per language (e.g. "leon" → city first hit, "Lion" later). */
const WIKI_OPENSEARCH_LIMIT = 15;
/** Max distinct titles to try per language after thumbnails + category + Wikidata filters. */
const WIKI_TITLE_TRY_MAX = 12;

/**
 * Search terms we treat as clearly not animals (plants, drugs, etc.) for user-facing copy.
 */
const NON_ANIMAL_INTENT_QUERIES = new Set([
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

/**
 * Try these article titles right after the raw query when OpenSearch ranks cities/people first.
 */
const WIKI_TITLE_AHEAD_HINTS: Record<string, string[]> = {
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

/**
 * Folds user input for Wikipedia matching: trim, strip combining marks (accents),
 * full lowercasing. Same logical term regardless of casing or diacritics.
 */
function foldAnimalQuery(raw: string): string {
  return raw
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** First occurrence wins; fold dedupes "Leon" vs "leon" for candidate lists. */
function dedupeTitlesByFold(titles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of titles) {
    const t = raw.trim();
    if (!t) continue;
    const key = foldAnimalQuery(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

const WIKIDATA_SEARCH_PER_LANG = 14;
const WIKIDATA_MAX_QIDS = 22;

/** Deduplicate Q-ids; first occurrence (e.g. Spanish hits before English) wins. */
function dedupeQids(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id?.startsWith("Q") || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function commonsThumbFromP18(filename: string, width: number): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;
}

function wikipediaTitleLooksAstronomyOrCosmology(title: string): boolean {
  const t = foldAnimalQuery(title.replace(/_/g, " "));
  return (
    /\(constellation\)/.test(t) ||
    /\(asterism\)/.test(t) ||
    /\bconstellation\b/.test(t) ||
    /\bconstelacion\b/.test(t) ||
    /\basterism\b/.test(t) ||
    /\basterismo\b/.test(t) ||
    /\bmessier\b/.test(t) ||
    /\bzodiac\b/.test(t) ||
    (t.includes("iau") && /\b(constellation|asterism)\b/.test(t))
  );
}

/** Titles that denote plants/drugs and are often confused with animal colloquial names. */
function wikipediaTitleExcludedAsNonAnimal(title: string): boolean {
  const t = foldAnimalQuery(title.replace(/_/g, " ").replace(/\([^)]*\)/g, " ").trim());
  const blocked = new Set(["khat", "catha edulis", "catha", "qat"]);
  return blocked.has(t);
}

function wikipediaCategoryBlobLooksAstronomy(categoryTitles: string[]): boolean {
  const blob = categoryTitles.join(" | ").toLowerCase();
  return [
    /\bconstellations?\b/,
    /\bconstelaciones?\b/,
    /\basterisms?\b/,
    /\b(open|globular)\s+clusters?\b/,
    /\bgalaxies\b/,
    /\bgalaxias\b/,
    /\bdwarf\s+planets?\b/,
    /\bplanetary\s+nebulae\b/,
    /\bnebulosae?\b/,
    /\bnebrosas?\b/,
    /\bdee?p[\s-]sky\b/,
    /\bastro?nom(y|ia|ical|i[ck]e)\b/,
    /\bcelestial\b/,
    /\bmessier\s+objects?\b/,
  ].some((p) => p.test(blob));
}

function pickSitelinkAvoidingAstronomy(
  entity: WikidataEntity
): { lang: WikiLang; title: string } | null {
  const en = wikidataSitelinkArticleTitle(entity, "enwiki");
  if (en && !wikipediaTitleLooksAstronomyOrCosmology(en) && !wikipediaTitleExcludedAsNonAnimal(en)) {
    return { lang: "en", title: en };
  }
  const es = wikidataSitelinkArticleTitle(entity, "eswiki");
  if (es && !wikipediaTitleLooksAstronomyOrCosmology(es) && !wikipediaTitleExcludedAsNonAnimal(es)) {
    return { lang: "es", title: es };
  }
  return null;
}

/**
 * Lead thumbnail for one article title (after OpenSearch / Wikidata sitelink).
 */
async function wikipediaLeadThumbnailUrl(lang: WikiLang, title: string): Promise<string | null> {
  const enc = encodeURIComponent(title.trim());
  const url = `${WIKI_ORIGINS[lang]}/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=640&redirects=1&titles=${enc}`;
  const logPayload = { title: title.trim(), lang, outbound: url };
  const logTag = `AnimalLookupService.wikipedia_thumb.${lang}`;

  try {
    const res = await fetchWithWikimediaRetry(url, logTag, logPayload);
    if (!res) {
      recordServiceInteraction(logTag, logPayload, "MediaWiki retries exhausted");
      return null;
    }
    if (!res.ok) {
      recordServiceInteraction(logTag, logPayload, `HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { missing?: string; thumbnail?: { source?: string } }> };
    };
    const pages = data.query?.pages;
    const first = pages ? Object.values(pages)[0] : undefined;
    if (!first?.thumbnail?.source || first.missing !== undefined) {
      recordServiceInteraction(logTag, logPayload, "No thumbnail");
      return null;
    }
    recordServiceInteraction(logTag, logPayload, null);
    return first.thumbnail.source;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction(logTag, logPayload, message);
    return null;
  }
}

/**
 * Wikidata first: hinted English taxon labels → label search → block sky objects (P31) →
 * Animalia climb must return **true** (plants, drugs, inconclusive → skip) → P18 or Wikipedia thumb.
 */
async function findAnimalImageViaWikidataFirst(
  trimmed: string,
  queryFolded: string
): Promise<{ imageUrl: string; wikipediaUrl: string } | null> {
  const hints = WIKI_TITLE_AHEAD_HINTS[queryFolded] ?? [];
  const hintIdLists = await Promise.all(
    hints.map((h) => wikidataSearchEntityIds(h, "en", 8))
  );
  const hintIds = hintIdLists.flat();

  const [idsEs, idsEn] = await Promise.all([
    wikidataSearchEntityIds(trimmed, "es", WIKIDATA_SEARCH_PER_LANG),
    wikidataSearchEntityIds(trimmed, "en", WIKIDATA_SEARCH_PER_LANG),
  ]);

  const orderedIds = dedupeQids([...hintIds, ...idsEs, ...idsEn]).slice(0, WIKIDATA_MAX_QIDS);
  if (orderedIds.length === 0) return null;

  const entityMap = await wikidataGetEntitiesClaimsAndSitelinks(orderedIds);
  if (!entityMap) return null;

  for (const qid of orderedIds) {
    const entity = entityMap[qid];
    if (!entity) continue;

    if (wikidataEntityP31BlockedForAnimalLookup(entity)) continue;

    const animal = await withFallbackAfterMs(
      wikidataItemIsUnderAnimalia(qid),
      WIKIDATA_ANIMAL_CHECK_BUDGET_MS,
      null
    );
    if (animal !== true) continue;

    const sitelink = pickSitelinkAvoidingAstronomy(entity);
    const wikipediaUrl =
      sitelink != null
        ? wikipediaArticleUrl(sitelink.lang, sitelink.title)
        : `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;

    const p18 = wikidataP18Filename(entity);
    if (p18) {
      return {
        imageUrl: commonsThumbFromP18(p18, 640),
        wikipediaUrl,
      };
    }

    if (sitelink) {
      const thumb = await wikipediaLeadThumbnailUrl(sitelink.lang, sitelink.title);
      if (thumb) {
        return { imageUrl: thumb, wikipediaUrl };
      }
      const altTitle =
        sitelink.lang === "en"
          ? wikidataSitelinkArticleTitle(entity, "eswiki")
          : wikidataSitelinkArticleTitle(entity, "enwiki");
      if (altTitle && !wikipediaTitleLooksAstronomyOrCosmology(altTitle) && !wikipediaTitleExcludedAsNonAnimal(altTitle)) {
        const altLang: WikiLang = sitelink.lang === "en" ? "es" : "en";
        const altThumb = await wikipediaLeadThumbnailUrl(altLang, altTitle);
        if (altThumb) {
          return { imageUrl: altThumb, wikipediaUrl: wikipediaArticleUrl(altLang, altTitle) };
        }
      }
    }
  }

  return null;
}

type WikiBatchPage = {
  pageid?: number;
  title?: string;
  missing?: string;
  categories?: Array<{ title: string }>;
  thumbnail?: { source?: string };
};

type WikiBatchResponse = {
  query?: {
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
    pages?: Record<string, WikiBatchPage>;
  };
};

function wikipediaArticleUrl(lang: WikiLang, title: string): string {
  const seg = title.trim().replace(/ /g, "_");
  return `${WIKI_ORIGINS[lang]}/wiki/${encodeURIComponent(seg)}`;
}

function wikiBatchCategoriesPageImagesUrl(lang: WikiLang, titles: string[]): string {
  const enc = titles.map((t) => encodeURIComponent(t.trim())).join("|");
  return (
    `${WIKI_ORIGINS[lang]}/w/api.php?action=query&format=json&redirects=1` +
    `&prop=categories|pageimages&cllimit=50&clshow=!hidden` +
    `&piprop=thumbnail&pithumbsize=640&titles=${enc}`
  );
}

function wikiOpenSearchUrl(lang: WikiLang, query: string, limit: number): string {
  return `${WIKI_ORIGINS[lang]}/w/api.php?action=opensearch&format=json&limit=${limit}&namespace=0&search=${encodeURIComponent(query)}`;
}

/** Heuristic: category titles suggest plant / fungus / non-target topic. */
function wikipediaCategoryBlobLooksNonAnimal(categoryTitles: string[]): boolean {
  const blob = categoryTitles.join(" | ").toLowerCase();
  const patterns: RegExp[] = [
    /\bplantae\b/,
    /\bplants?\b/,
    /\bfungi\b/,
    /\bbotan/i,
    /\bflora\b/,
    /\bherbs?\b/,
    /\bvegetables?\b/,
    /\bflowers?\b/,
    /\balgae\b/,
    /\brosales\b/,
    /\bcannabis\b/,
    /\bcrops?\b/,
    /\bkhat\b/,
    /\bcatha\b/,
    /\bcathinone\b/,
    /\balkaloids?\b/,
    /\bstimulants?\b/,
    /\bpsychoactive\b/,
    /\bentheogens?\b/,
    /\btrees?\b/,
    /\bshrubs?\b/,
    /\bfruits?\b/,
    /\bdioecious\b/,
    /\bevergreen\b/,
    /\bdeciduous\b/,
    /\bpoales\b/,
    /\basteraceae\b/,
  ];
  return patterns.some((p) => p.test(blob));
}

/** Biography / celebrity / politics categories — Wikidata still says “animal” for humans. */
function wikipediaCategoryBlobLooksPersonArticle(categoryTitles: string[]): boolean {
  const blob = categoryTitles.join(" | ").toLowerCase();
  const patterns: RegExp[] = [
    /\bliving people\b/,
    /\bdead people\b/,
    /\bdeaths in \d/,
    /\bbirths in \d/,
    /\bnacidos en \d/,
    /\bfallecidos en \d/,
    /\bmale film actors\b/,
    /\bamerican male film actors\b/,
    /\bactress(?:es)?\b/,
    /\bactors\b/,
    /\bactores\b/,
    /\bactrices\b/,
    /\bpolitic(?:os|al|ians?)\b/,
    /\bmusicians\b/,
    /\bmúsicos\b/,
    /\bfilm directors\b/,
    /\bdirector(?:es)? de cine\b/,
    /\bsportspeople\b/,
    /\bdeportistas\b/,
  ];
  return patterns.some((p) => p.test(blob));
}

function resolvedTitleForCandidate(
  candidate: string,
  normalized: Array<{ from: string; to: string }>,
  redirects: Array<{ from: string; to: string }>
): string {
  let t = candidate.trim();
  const normHit = normalized.find((n) => n.from === t);
  if (normHit) t = normHit.to;
  for (let i = 0; i < 25; i++) {
    const red = redirects.find((r) => r.from === t);
    if (!red) break;
    t = red.to;
  }
  return t;
}

function findBatchPageForResolvedTitle(
  resolved: string,
  pagesByTitle: Map<string, WikiBatchPage>
): WikiBatchPage | undefined {
  let page = pagesByTitle.get(resolved);
  if (page) return page;
  const target = foldAnimalQuery(resolved.replace(/_/g, " "));
  for (const [pageTitle, p] of pagesByTitle) {
    if (foldAnimalQuery(pageTitle.replace(/_/g, " ")) === target) return p;
  }
  return undefined;
}

/**
 * One batch request: categories + lead thumbnail for all candidate titles (with redirects).
 */
async function wikipediaBatchCategoriesPageImages(
  lang: WikiLang,
  titles: string[]
): Promise<{
  normalized: Array<{ from: string; to: string }>;
  redirects: Array<{ from: string; to: string }>;
  pagesByTitle: Map<string, WikiBatchPage>;
} | null> {
  const cleaned = titles.map((t) => t.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  const url = wikiBatchCategoriesPageImagesUrl(lang, cleaned);
  const logPayload = { lang, titleCount: cleaned.length, outbound: url };
  const logTag = `AnimalLookupService.wikipedia_batch.${lang}`;

  try {
    const res = await fetchWithWikimediaRetry(url, logTag, logPayload);
    if (!res) {
      recordServiceInteraction(logTag, logPayload, "MediaWiki retries exhausted");
      return null;
    }
    if (!res.ok) {
      recordServiceInteraction(logTag, logPayload, `HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as WikiBatchResponse;
    const pages = data.query?.pages;
    if (!pages) {
      recordServiceInteraction(logTag, logPayload, "No pages in batch response");
      return null;
    }

    const pagesByTitle = new Map<string, WikiBatchPage>();
    for (const p of Object.values(pages)) {
      if (p?.title) pagesByTitle.set(p.title, p);
    }

    recordServiceInteraction(logTag, logPayload, null);
    return {
      normalized: data.query?.normalized ?? [],
      redirects: data.query?.redirects ?? [],
      pagesByTitle,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction(logTag, logPayload, message);
    return null;
  }
}

async function wikipediaOpenSearchTitles(
  foldedQuery: string,
  lang: WikiLang,
  limit: number
): Promise<string[]> {
  if (!foldedQuery) return [];
  const url = wikiOpenSearchUrl(lang, foldedQuery, limit);
  const logPayload = { foldedQuery, lang, outbound: url };
  const logTag = `AnimalLookupService.wikipedia_opensearch.${lang}`;

  try {
    const res = await fetchWithWikimediaRetry(url, logTag, logPayload);
    if (!res) {
      recordServiceInteraction(logTag, logPayload, "MediaWiki retries exhausted");
      return [];
    }
    if (!res.ok) {
      recordServiceInteraction(logTag, logPayload, `Wikipedia OpenSearch HTTP ${res.status}`);
      return [];
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[1])) {
      recordServiceInteraction(logTag, logPayload, "OpenSearch JSON shape unexpected");
      return [];
    }
    const titles = data[1] as string[];
    if (titles.length === 0) {
      recordServiceInteraction(logTag, logPayload, "OpenSearch returned no titles");
      return [];
    }
    recordServiceInteraction(logTag, logPayload, null);
    return titles.map((t) => t.trim()).filter(Boolean);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction(logTag, logPayload, message);
    return [];
  }
}

async function withFallbackAfterMs<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

/**
 * OpenSearch for titles, then one MediaWiki batch (categories + thumbnails) for all candidates.
 * Wikidata runs only while walking candidates, using data from that batch (no extra page fetches).
 */
async function findAnimalArticleOnWikipedia(
  queryFolded: string,
  lang: WikiLang
): Promise<{ imageUrl: string; wikipediaUrl: string } | null> {
  const os = await wikipediaOpenSearchTitles(queryFolded, lang, WIKI_OPENSEARCH_LIMIT);
  const hints = WIKI_TITLE_AHEAD_HINTS[queryFolded] ?? [];
  const candidates = dedupeTitlesByFold([queryFolded, ...hints, ...os]).slice(
    0,
    WIKI_TITLE_TRY_MAX
  );

  const batch = await wikipediaBatchCategoriesPageImages(lang, candidates);
  if (!batch) return null;

  const { normalized, redirects, pagesByTitle } = batch;

  for (const candidate of candidates) {
    const resolved = resolvedTitleForCandidate(candidate, normalized, redirects);
    const page = findBatchPageForResolvedTitle(resolved, pagesByTitle);
    if (!page || page.missing !== undefined) continue;
    const thumb = page.thumbnail?.source ?? null;
    if (!thumb) continue;

    const catTitles = page.categories?.map((c) => c.title) ?? [];
    if (wikipediaCategoryBlobLooksNonAnimal(catTitles)) continue;
    if (wikipediaCategoryBlobLooksPersonArticle(catTitles)) continue;
    if (wikipediaCategoryBlobLooksAstronomy(catTitles)) continue;

    const pageTitle = page.title?.trim() ?? resolved;
    if (wikipediaTitleExcludedAsNonAnimal(pageTitle)) continue;
    if (wikipediaTitleLooksAstronomyOrCosmology(pageTitle)) continue;
    const wd = await withFallbackAfterMs(
      wikipediaArticleIsAnimalTaxon(pageTitle, lang),
      WIKIDATA_ANIMAL_CHECK_BUDGET_MS,
      null
    );
    if (wd !== true) continue;

    return {
      imageUrl: thumb,
      wikipediaUrl: wikipediaArticleUrl(lang, pageTitle),
    };
  }
  return null;
}

const FALLBACK_MESSAGE_ES =
  "Ups, no lo pudimos encontrar, pero aqui tienes un gatito.";

const FALLBACK_NON_ANIMAL_MESSAGE_ES =
  "Eso no es un animal asi que no lo pudimos encontrar - aqui tienes un gatito de todos modos";

/**
 * Resolves an animal name: Wikidata label search → Animalia → P18 or Wikipedia lead image;
 * then Wikipedia OpenSearch batch fallback; then cat. `displayName` is the user’s trimmed input on success.
 */
export async function lookupAnimalByName(name: string): Promise<AnimalLookupResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    recordServiceInteraction(
      "AnimalLookupService.lookup",
      { name: trimmed },
      "Empty animal name"
    );
    const catUrl = (await fetchRandomCatImageUrl()) ?? "";
    return {
      displayName: trimmed,
      imageUrl: catUrl,
      usedFallback: true,
      message: FALLBACK_MESSAGE_ES,
      wikipediaUrl: null,
    };
  }

  const queryFolded = foldAnimalQuery(name);
  if (!queryFolded) {
    recordServiceInteraction(
      "AnimalLookupService.lookup",
      { name: trimmed, queryFolded },
      "Animal name empty after accent/case fold"
    );
    const catUrl = (await fetchRandomCatImageUrl()) ?? "";
    return {
      displayName: trimmed,
      imageUrl: catUrl,
      usedFallback: true,
      message: FALLBACK_MESSAGE_ES,
      wikipediaUrl: null,
    };
  }

  let suggestNonAnimalFallback = NON_ANIMAL_INTENT_QUERIES.has(queryFolded);

  const wikidataHit = await findAnimalImageViaWikidataFirst(trimmed, queryFolded);
  if (wikidataHit) {
    return {
      displayName: trimmed,
      imageUrl: wikidataHit.imageUrl,
      usedFallback: false,
      message: null,
      wikipediaUrl: wikidataHit.wikipediaUrl,
    };
  }

  const wikiHit =
    (await findAnimalArticleOnWikipedia(queryFolded, "en")) ??
    (await findAnimalArticleOnWikipedia(queryFolded, "es"));

  if (wikiHit) {
    return {
      displayName: trimmed,
      imageUrl: wikiHit.imageUrl,
      usedFallback: false,
      message: null,
      wikipediaUrl: wikiHit.wikipediaUrl,
    };
  }

  const catUrl = await fetchRandomCatImageUrl();
  recordServiceInteraction(
    "AnimalLookupService.lookup",
    { name: trimmed, queryFolded, source: "thecatapi_fallback" },
    null
  );
  return {
    displayName: trimmed,
    imageUrl: catUrl ?? "",
    usedFallback: true,
    message: suggestNonAnimalFallback ? FALLBACK_NON_ANIMAL_MESSAGE_ES : FALLBACK_MESSAGE_ES,
    wikipediaUrl: null,
  };
}
