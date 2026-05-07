import type { AnimalLookupResult } from "../../types/animal.types.js";
import {
  fetchNinjasAnimals,
  ninjaWikiLookupSeed,
  pickNinjaAnimalRecord,
} from "./animals-ninjas.service.js";
import { fetchRandomCatImageUrl } from "./cat-api.service.js";
import { recordServiceInteraction } from "./request-log.service.js";
import { wikipediaArticleIsAnimalTaxon } from "./wikidata-animal.service.js";

const USER_AGENT = "EvalHomework/1.0 (educational; contact student)";

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

type WikiQueryResponse = {
  query?: {
    pages?: Record<
      string,
      {
        pageid?: number;
        title?: string;
        missing?: string;
        thumbnail?: { source?: string };
      }
    >;
  };
};

function wikiPageImagesUrl(lang: WikiLang, title: string): string {
  const enc = encodeURIComponent(title.trim());
  return `${WIKI_ORIGINS[lang]}/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=640&redirects=1&titles=${enc}`;
}

function wikiOpenSearchUrl(lang: WikiLang, query: string, limit: number): string {
  return `${WIKI_ORIGINS[lang]}/w/api.php?action=opensearch&format=json&limit=${limit}&namespace=0&search=${encodeURIComponent(query)}`;
}

type WikiCategoriesResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        categories?: Array<{ title: string }>;
      }
    >;
  };
};

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

/**
 * One categories fetch for heuristics. `null` means the API failed — do not reject the title on that alone.
 */
async function wikipediaTitleCategorySignals(
  title: string,
  lang: WikiLang
): Promise<{ plantLike: boolean; personLike: boolean } | null> {
  const enc = encodeURIComponent(title.trim());
  const url = `${WIKI_ORIGINS[lang]}/w/api.php?action=query&format=json&prop=categories&cllimit=50&clshow=!hidden&titles=${enc}`;
  const logPayload = { title: title.trim(), lang, outbound: url };

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      recordServiceInteraction(
        "AnimalLookupService.wikipedia_categories",
        logPayload,
        `HTTP ${res.status}`
      );
      return null;
    }

    const data = (await res.json()) as WikiCategoriesResponse;
    const pages = data.query?.pages;
    if (!pages) {
      recordServiceInteraction("AnimalLookupService.wikipedia_categories", logPayload, "No pages");
      return null;
    }

    const first = Object.values(pages)[0];
    const cats = first?.categories?.map((c) => c.title) ?? [];
    if (cats.length === 0) {
      recordServiceInteraction(
        "AnimalLookupService.wikipedia_categories",
        logPayload,
        "No categories"
      );
      return { plantLike: false, personLike: false };
    }

    const plantLike = wikipediaCategoryBlobLooksNonAnimal(cats);
    const personLike = wikipediaCategoryBlobLooksPersonArticle(cats);
    let note: string | null = null;
    if (plantLike) note = "Categories look plant/fungus/non-animal (heuristic)";
    else if (personLike) note = "Categories look person/biography (heuristic)";
    recordServiceInteraction("AnimalLookupService.wikipedia_categories", logPayload, note);
    return { plantLike, personLike };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("AnimalLookupService.wikipedia_categories", logPayload, message);
    return null;
  }
}

/**
 * Requests a thumbnail URL from a Wikipedia language edition (same API, different host).
 */
async function wikipediaThumbnailUrl(
  animalName: string,
  lang: WikiLang
): Promise<{ title: string; url: string | null }> {
  const url = wikiPageImagesUrl(lang, animalName);
  const logPayload = { animalName: animalName.trim(), lang, outbound: url };
  const logTag = `AnimalLookupService.wikipedia.${lang}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      recordServiceInteraction(logTag, logPayload, `Wikipedia HTTP ${res.status}`);
      return { title: animalName.trim(), url: null };
    }

    const data = (await res.json()) as WikiQueryResponse;
    const pages = data.query?.pages;
    if (!pages) {
      recordServiceInteraction(logTag, logPayload, "No pages key in Wikipedia JSON");
      return { title: animalName.trim(), url: null };
    }

    const first = Object.values(pages)[0];
    if (!first || first.missing !== undefined || !first.thumbnail?.source) {
      recordServiceInteraction(
        logTag,
        logPayload,
        "No thumbnail for this title (missing page or no image)"
      );
      return {
        title: first?.title ?? animalName.trim(),
        url: null,
      };
    }

    recordServiceInteraction(logTag, logPayload, null);
    return { title: first.title ?? animalName.trim(), url: first.thumbnail.source };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction(logTag, logPayload, message);
    return { title: animalName.trim(), url: null };
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
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
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
 * Tries several OpenSearch candidates (plus the raw query) so ambiguous terms like "leon"
 * do not stop on the city article when a later hit is the animal (e.g. Lion).
 */
async function findAnimalArticleOnWikipedia(
  queryFolded: string,
  lang: WikiLang
): Promise<{ title: string; url: string } | null> {
  const os = await wikipediaOpenSearchTitles(queryFolded, lang, WIKI_OPENSEARCH_LIMIT);
  const hints = WIKI_TITLE_AHEAD_HINTS[queryFolded] ?? [];
  const candidates = dedupeTitlesByFold([queryFolded, ...hints, ...os]).slice(
    0,
    WIKI_TITLE_TRY_MAX
  );

  for (const title of candidates) {
    const wiki = await wikipediaThumbnailUrl(title, lang);
    if (!wiki.url) continue;

    const sig = await wikipediaTitleCategorySignals(wiki.title, lang);
    if (sig !== null && (sig.plantLike || sig.personLike)) continue;

    const wd = await withFallbackAfterMs(
      wikipediaArticleIsAnimalTaxon(wiki.title, lang),
      WIKIDATA_ANIMAL_CHECK_BUDGET_MS,
      null
    );
    if (wd === false) continue;

    return { title: wiki.title, url: wiki.url };
  }
  return null;
}

const FALLBACK_MESSAGE_ES =
  "Ups, no lo pudimos encontrar, pero aqui tienes un gatito.";

const FALLBACK_NON_ANIMAL_MESSAGE_ES =
  "Eso no es un animal asi que no lo pudimos encontrar - aqui tienes un gatito de todos modos";

/**
 * Resolves an animal name. Optional API Ninjas validation, then Wikipedia (en → es)
 * with several OpenSearch candidates per language, Wikidata Animalia check, then cat fallbacks.
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
    };
  }

  let suggestNonAnimalFallback = NON_ANIMAL_INTENT_QUERIES.has(queryFolded);

  let wikiLookupFolded = queryFolded;
  let preferredDisplayName: string | null = null;

  const ninjas = await fetchNinjasAnimals(trimmed);
  if (ninjas.status === "ok") {
    const picked = pickNinjaAnimalRecord(ninjas.records);
    if (!picked) {
      recordServiceInteraction(
        "AnimalLookupService.lookup",
        { name: trimmed, queryFolded, source: "api_ninjas_no_animal_match" },
        null
      );
      const catUrl = await fetchRandomCatImageUrl();
      return {
        displayName: trimmed,
        imageUrl: catUrl ?? "",
        usedFallback: true,
        message: FALLBACK_NON_ANIMAL_MESSAGE_ES,
      };
    }
    wikiLookupFolded = foldAnimalQuery(ninjaWikiLookupSeed(picked));
    preferredDisplayName = picked.name.trim();
  }

  const wikiHit =
    (await findAnimalArticleOnWikipedia(wikiLookupFolded, "en")) ??
    (await findAnimalArticleOnWikipedia(wikiLookupFolded, "es"));

  if (wikiHit) {
    return {
      displayName: preferredDisplayName ?? wikiHit.title,
      imageUrl: wikiHit.url,
      usedFallback: false,
      message: null,
    };
  }

  const catUrl = await fetchRandomCatImageUrl();
  recordServiceInteraction(
    "AnimalLookupService.lookup",
    { name: trimmed, queryFolded, source: "thecatapi_fallback" },
    null
  );
  return {
    displayName: preferredDisplayName ?? trimmed,
    imageUrl: catUrl ?? "",
    usedFallback: true,
    message: suggestNonAnimalFallback ? FALLBACK_NON_ANIMAL_MESSAGE_ES : FALLBACK_MESSAGE_ES,
  };
}
