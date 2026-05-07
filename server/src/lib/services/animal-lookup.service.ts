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

function wikiOpenSearchUrl(lang: WikiLang, query: string): string {
  return `${WIKI_ORIGINS[lang]}/w/api.php?action=opensearch&format=json&limit=5&namespace=0&search=${encodeURIComponent(query)}`;
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

/**
 * true → reject Wikipedia image for animal lookup (plant-like categories).
 * false → categories loaded, no plant/fungi heuristic match.
 * null → unavailable; do not block on this signal alone.
 */
async function wikipediaTitleCategoriesLookPlant(
  title: string,
  lang: WikiLang
): Promise<boolean | null> {
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
      return null;
    }

    const planty = wikipediaCategoryBlobLooksNonAnimal(cats);
    recordServiceInteraction(
      "AnimalLookupService.wikipedia_categories",
      logPayload,
      planty ? "Categories look plant/fungus/non-animal (heuristic)" : null
    );
    return planty;
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

async function wikipediaOpenSearchFirstTitle(
  foldedQuery: string,
  lang: WikiLang
): Promise<string | null> {
  if (!foldedQuery) return null;
  const url = wikiOpenSearchUrl(lang, foldedQuery);
  const logPayload = { foldedQuery, lang, outbound: url };
  const logTag = `AnimalLookupService.wikipedia_opensearch.${lang}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      recordServiceInteraction(logTag, logPayload, `Wikipedia OpenSearch HTTP ${res.status}`);
      return null;
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[1])) {
      recordServiceInteraction(logTag, logPayload, "OpenSearch JSON shape unexpected");
      return null;
    }
    const titles = data[1] as string[];
    const first = titles?.[0]?.trim();
    if (!first) {
      recordServiceInteraction(logTag, logPayload, "OpenSearch returned no titles");
      return null;
    }
    recordServiceInteraction(logTag, logPayload, null);
    return first;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction(logTag, logPayload, message);
    return null;
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

async function resolveViaWikipediaLang(
  queryFolded: string,
  lang: WikiLang
): Promise<{ title: string; url: string | null }> {
  let wiki = await wikipediaThumbnailUrl(queryFolded, lang);
  if (!wiki.url) {
    const osTitle = await wikipediaOpenSearchFirstTitle(queryFolded, lang);
    if (osTitle) {
      wiki = await wikipediaThumbnailUrl(osTitle, lang);
    }
  }
  return wiki;
}

const FALLBACK_MESSAGE_ES =
  "Ups, no lo pudimos encontrar, pero aqui tienes un gatito.";

const FALLBACK_NON_ANIMAL_MESSAGE_ES =
  "Eso no es un animal asi que no lo pudimos encontrar - aqui tienes un gatito de todos modos";

/**
 * Resolves an animal name. Optional API Ninjas validation, then Wikipedia (en → es),
 * Wikidata kingdom Animalia check, TheCatAPI fallback.
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

  let wikiLang: WikiLang | null = null;
  let wiki = await resolveViaWikipediaLang(wikiLookupFolded, "en");
  if (wiki.url) wikiLang = "en";
  if (!wiki.url) {
    wiki = await resolveViaWikipediaLang(wikiLookupFolded, "es");
    if (wiki.url) wikiLang = "es";
  }

  if (wiki.url && wikiLang) {
    let acceptWikipedia = true;

    const plantCategories = await wikipediaTitleCategoriesLookPlant(wiki.title, wikiLang);
    if (plantCategories === true) {
      suggestNonAnimalFallback = true;
      acceptWikipedia = false;
      recordServiceInteraction(
        "AnimalLookupService.lookup",
        {
          name: trimmed,
          queryFolded,
          wikipediaTitle: wiki.title,
          note: "wikipedia_rejected_plant_like_categories",
        },
        null
      );
    }

    if (acceptWikipedia) {
      const wikidataConfirmsAnimal = await withFallbackAfterMs(
        wikipediaArticleIsAnimalTaxon(wiki.title, wikiLang),
        WIKIDATA_ANIMAL_CHECK_BUDGET_MS,
        null
      );
      if (wikidataConfirmsAnimal === false) {
        acceptWikipedia = false;
        recordServiceInteraction(
          "AnimalLookupService.lookup",
          {
            name: trimmed,
            queryFolded,
            wikipediaTitle: wiki.title,
            note: "wikipedia_rejected_wikidata_not_under_animalia",
          },
          null
        );
      }
    }

    if (acceptWikipedia) {
      return {
        displayName: preferredDisplayName ?? wiki.title,
        imageUrl: wiki.url,
        usedFallback: false,
        message: null,
      };
    }
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
