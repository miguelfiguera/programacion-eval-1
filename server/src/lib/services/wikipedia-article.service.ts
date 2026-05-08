/**
 * Wikipedia REST / MediaWiki interactions for the animal-lookup pipeline.
 * OpenSearch, batch category+pageimage queries, lead thumbnails.
 */

import { fetchWithWikimediaRetry } from "../wikimedia-http.js";
import { recordServiceInteraction } from "./request-log.service.js";

// ── types ───────────────────────────────────────────────────────────

export type WikiLang = "en" | "es";

export type WikiBatchPage = {
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

export type WikiBatchResult = {
  normalized: Array<{ from: string; to: string }>;
  redirects: Array<{ from: string; to: string }>;
  pagesByTitle: Map<string, WikiBatchPage>;
};

// ── constants ───────────────────────────────────────────────────────

const ORIGINS: Record<WikiLang, string> = {
  en: "https://en.wikipedia.org",
  es: "https://es.wikipedia.org",
};

// ── URL builders ────────────────────────────────────────────────────

export function articleUrl(lang: WikiLang, title: string): string {
  return `${ORIGINS[lang]}/wiki/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`;
}

function openSearchUrl(lang: WikiLang, query: string, limit: number): string {
  return `${ORIGINS[lang]}/w/api.php?action=opensearch&format=json&limit=${limit}&namespace=0&search=${encodeURIComponent(query)}`;
}

function batchUrl(lang: WikiLang, titles: string[]): string {
  const enc = titles.map((t) => encodeURIComponent(t.trim())).join("|");
  return (
    `${ORIGINS[lang]}/w/api.php?action=query&format=json&redirects=1` +
    `&prop=categories|pageimages&cllimit=50&clshow=!hidden` +
    `&piprop=thumbnail&pithumbsize=640&titles=${enc}`
  );
}

function thumbUrl(lang: WikiLang, title: string): string {
  const enc = encodeURIComponent(title.trim());
  return `${ORIGINS[lang]}/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=640&redirects=1&titles=${enc}`;
}

// ── OpenSearch ──────────────────────────────────────────────────────

/** Returns article titles matching a search query via Wikipedia OpenSearch. */
export async function openSearchTitles(
  query: string,
  lang: WikiLang,
  limit: number,
): Promise<string[]> {
  if (!query) return [];

  const url = openSearchUrl(lang, query, limit);
  const logTag = `Wikipedia.opensearch.${lang}`;
  const logPayload = { query, lang, outbound: url };

  try {
    const res = await fetchWithWikimediaRetry(url, logTag, logPayload);
    if (!res?.ok) {
      recordServiceInteraction(logTag, logPayload, res ? `HTTP ${res.status}` : "Retries exhausted");
      return [];
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[1])) {
      recordServiceInteraction(logTag, logPayload, "Unexpected JSON shape");
      return [];
    }
    const titles = (data[1] as string[]).map((t) => t.trim()).filter(Boolean);
    recordServiceInteraction(logTag, logPayload, titles.length === 0 ? "No titles" : null);
    return titles;
  } catch (err) {
    recordServiceInteraction(logTag, logPayload, err instanceof Error ? err.message : String(err));
    return [];
  }
}

// ── Batch categories + pageimages ───────────────────────────────────

/** One batch request: categories + lead thumbnail for all candidate titles. */
export async function batchCategoriesAndImages(
  lang: WikiLang,
  titles: string[],
): Promise<WikiBatchResult | null> {
  const cleaned = titles.map((t) => t.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  const url = batchUrl(lang, cleaned);
  const logTag = `Wikipedia.batch.${lang}`;
  const logPayload = { lang, titleCount: cleaned.length, outbound: url };

  try {
    const res = await fetchWithWikimediaRetry(url, logTag, logPayload);
    if (!res?.ok) {
      recordServiceInteraction(logTag, logPayload, res ? `HTTP ${res.status}` : "Retries exhausted");
      return null;
    }

    const data = (await res.json()) as WikiBatchResponse;
    const pages = data.query?.pages;
    if (!pages) {
      recordServiceInteraction(logTag, logPayload, "No pages in response");
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
    recordServiceInteraction(logTag, logPayload, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ── Lead thumbnail ──────────────────────────────────────────────────

/** Fetches the lead thumbnail URL for a single Wikipedia article. */
export async function leadThumbnailUrl(
  lang: WikiLang,
  title: string,
): Promise<string | null> {
  const url = thumbUrl(lang, title);
  const logTag = `Wikipedia.thumb.${lang}`;
  const logPayload = { title: title.trim(), lang, outbound: url };

  try {
    const res = await fetchWithWikimediaRetry(url, logTag, logPayload);
    if (!res?.ok) {
      recordServiceInteraction(logTag, logPayload, res ? `HTTP ${res.status}` : "Retries exhausted");
      return null;
    }
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { missing?: string; thumbnail?: { source?: string } }> };
    };
    const first = data.query?.pages ? Object.values(data.query.pages)[0] : undefined;
    if (!first?.thumbnail?.source || first.missing !== undefined) {
      recordServiceInteraction(logTag, logPayload, "No thumbnail");
      return null;
    }
    recordServiceInteraction(logTag, logPayload, null);
    return first.thumbnail.source;
  } catch (err) {
    recordServiceInteraction(logTag, logPayload, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ── Redirect / normalisation resolution ─────────────────────────────

/** Follows normalisation + redirect chains to find the final page title. */
export function resolveTitle(
  candidate: string,
  normalized: Array<{ from: string; to: string }>,
  redirects: Array<{ from: string; to: string }>,
): string {
  let t = candidate.trim();
  const norm = normalized.find((n) => n.from === t);
  if (norm) t = norm.to;
  for (let i = 0; i < 25; i++) {
    const red = redirects.find((r) => r.from === t);
    if (!red) break;
    t = red.to;
  }
  return t;
}

/** Finds a page in the batch map by resolved title (case-insensitive fallback). */
export function findPageByTitle(
  resolved: string,
  pages: Map<string, WikiBatchPage>,
): WikiBatchPage | undefined {
  const direct = pages.get(resolved);
  if (direct) return direct;

  const target = resolved.replace(/_/g, " ").toLowerCase();
  for (const [key, page] of pages) {
    if (key.replace(/_/g, " ").toLowerCase() === target) return page;
  }
  return undefined;
}
