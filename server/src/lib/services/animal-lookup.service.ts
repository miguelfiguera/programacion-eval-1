import type { AnimalLookupResult } from "../../types/animal.types.js";
import { fetchRandomCatImageUrl } from "./cat-api.service.js";
import { recordServiceInteraction } from "./request-log.service.js";

const USER_AGENT = "EvalHomework/1.0 (educational; contact student)";

const WIKI_ORIGINS = {
  en: "https://en.wikipedia.org",
  es: "https://es.wikipedia.org",
} as const;

type WikiLang = keyof typeof WIKI_ORIGINS;

/** iNaturalist: kingdom Animalia taxon id in `ancestor_ids` (metazoa / animals only). */
const INAT_ANIMALIA_TAXON_ID = 1;

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

type InatTaxaResponse = {
  results?: Array<{
    name: string;
    preferred_common_name?: string | null;
    ancestor_ids?: number[];
    default_photo?: { medium_url?: string; url?: string } | null;
  }>;
};

/**
 * Free iNaturalist taxa search (no API key). Keeps only taxa under kingdom Animalia.
 */
async function inaturalistFirstAnimalPhoto(
  query: string
): Promise<{ title: string; url: string | null }> {
  const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(
    query
  )}&per_page=20&order=desc&order_by=observations_count`;
  const logPayload = { query, outbound: url };

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      recordServiceInteraction(
        "AnimalLookupService.inaturalist",
        logPayload,
        `iNaturalist HTTP ${res.status}`
      );
      return { title: query, url: null };
    }

    const data = (await res.json()) as InatTaxaResponse;
    const rows = data.results ?? [];
    const pick = rows.find(
      (r) =>
        Boolean(r.default_photo?.medium_url) &&
        Array.isArray(r.ancestor_ids) &&
        r.ancestor_ids.includes(INAT_ANIMALIA_TAXON_ID)
    );

    if (!pick?.default_photo?.medium_url) {
      recordServiceInteraction(
        "AnimalLookupService.inaturalist",
        logPayload,
        "No Animalia taxon with photo in iNaturalist results"
      );
      return { title: query, url: null };
    }

    recordServiceInteraction("AnimalLookupService.inaturalist", logPayload, null);
    const title = pick.preferred_common_name?.trim() || pick.name;
    return { title, url: pick.default_photo.medium_url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("AnimalLookupService.inaturalist", logPayload, message);
    return { title: query, url: null };
  }
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

/**
 * Resolves an animal name: English Wikipedia → Spanish Wikipedia → iNaturalist → TheCatAPI.
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

  let wiki = await resolveViaWikipediaLang(queryFolded, "en");
  if (!wiki.url) {
    wiki = await resolveViaWikipediaLang(queryFolded, "es");
  }

  if (wiki.url) {
    return {
      displayName: wiki.title,
      imageUrl: wiki.url,
      usedFallback: false,
      message: null,
    };
  }

  const inat = await inaturalistFirstAnimalPhoto(queryFolded);
  if (inat.url) {
    return {
      displayName: inat.title,
      imageUrl: inat.url,
      usedFallback: true,
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
    displayName: wiki.title,
    imageUrl: catUrl ?? "",
    usedFallback: true,
    message: FALLBACK_MESSAGE_ES,
  };
}
