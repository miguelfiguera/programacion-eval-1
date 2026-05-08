/**
 * Orchestrator: resolves an animal name to an image + Wikipedia link.
 *
 * Pipeline:
 *   1. Wikidata label search → must confirm kingdom Animalia → P18 or Wikipedia thumb.
 *   2. Wikipedia OpenSearch batch → category + Wikidata Animalia check → thumb.
 *   3. Cat image fallback (TheCatAPI).
 *
 * Every candidate MUST pass a positive Animalia verification before being returned.
 */

import type { AnimalLookupResult } from "../../types/animal.types.js";
import { fetchRandomCatImageUrl } from "./cat-api.service.js";
import { recordServiceInteraction } from "./request-log.service.js";
import {
  foldQuery,
  dedupeQids,
  dedupeTitlesByFold,
  NON_ANIMAL_QUERIES,
  TITLE_HINTS,
  titleShouldSkip,
  categoriesShouldSkip,
} from "./animal-filters.js";
import {
  type WikiLang,
  articleUrl,
  openSearchTitles,
  batchCategoriesAndImages,
  leadThumbnailUrl,
  resolveTitle,
  findPageByTitle,
} from "./wikipedia-article.service.js";
import {
  type WikidataEntity,
  wikidataEntityP31BlockedForAnimalLookup,
  wikidataGetEntitiesClaimsAndSitelinks,
  wikidataItemIsUnderAnimalia,
  wikidataP18Filename,
  wikidataSearchEntityIds,
  wikidataSitelinkArticleTitle,
  wikipediaArticleIsAnimalTaxon,
} from "./wikidata-animal.service.js";

// ── constants ───────────────────────────────────────────────────────

const ANIMALIA_CHECK_TIMEOUT_MS = 8500;
const OPENSEARCH_LIMIT = 15;
const MAX_CANDIDATES = 12;
const WIKIDATA_SEARCH_PER_LANG = 14;
const WIKIDATA_MAX_QIDS = 22;

const FALLBACK_MSG = "Ups, no lo pudimos encontrar, pero aqui tienes un gatito.";
const FALLBACK_NON_ANIMAL_MSG =
  "Eso no es un animal asi que no lo pudimos encontrar - aqui tienes un gatito de todos modos";

// ── helpers ─────────────────────────────────────────────────────────

/** Races a promise against a timeout; returns fallback on timeout or rejection. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch(() => { clearTimeout(timer); resolve(fallback); });
  });
}

function commonsThumbUrl(filename: string, width = 640): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;
}

/** Picks the best sitelink (en preferred, then es), skipping bad titles. */
function pickSitelink(entity: WikidataEntity): { lang: WikiLang; title: string } | null {
  for (const [site, lang] of [["enwiki", "en"], ["eswiki", "es"]] as const) {
    const title = wikidataSitelinkArticleTitle(entity, site);
    if (title && !titleShouldSkip(title)) return { lang, title };
  }
  return null;
}

/** Confirms a Wikidata Q-id belongs to kingdom Animalia (with timeout). */
async function confirmAnimalia(qid: string): Promise<boolean> {
  const result = await withTimeout(
    wikidataItemIsUnderAnimalia(qid),
    ANIMALIA_CHECK_TIMEOUT_MS,
    null,
  );
  return result === true;
}

/** Confirms a Wikipedia article is an animal taxon via Wikidata (with timeout). */
async function confirmArticleIsAnimal(title: string, lang: WikiLang): Promise<boolean> {
  const result = await withTimeout(
    wikipediaArticleIsAnimalTaxon(title, lang),
    ANIMALIA_CHECK_TIMEOUT_MS,
    null,
  );
  return result === true;
}

// ── path 1: Wikidata-first ──────────────────────────────────────────

async function viaWikidata(
  trimmed: string,
  folded: string,
): Promise<{ imageUrl: string; wikipediaUrl: string } | null> {
  // collect entity IDs: hints first, then es, then en
  const hints = TITLE_HINTS[folded] ?? [];
  const [hintIds, idsEs, idsEn] = await Promise.all([
    Promise.all(hints.map((h) => wikidataSearchEntityIds(h, "en", 8))).then((r) => r.flat()),
    wikidataSearchEntityIds(trimmed, "es", WIKIDATA_SEARCH_PER_LANG),
    wikidataSearchEntityIds(trimmed, "en", WIKIDATA_SEARCH_PER_LANG),
  ]);

  const qids = dedupeQids([...hintIds, ...idsEs, ...idsEn]).slice(0, WIKIDATA_MAX_QIDS);
  if (qids.length === 0) return null;

  const entityMap = await wikidataGetEntitiesClaimsAndSitelinks(qids);
  if (!entityMap) return null;

  for (const qid of qids) {
    const entity = entityMap[qid];
    if (!entity) continue;

    // skip clearly non-animal P31 (constellations, plants, etc.)
    if (wikidataEntityP31BlockedForAnimalLookup(entity)) continue;

    // MUST confirm Animalia — skip if false or inconclusive
    if (!(await confirmAnimalia(qid))) continue;

    // build Wikipedia link from sitelink (or fall back to Wikidata URL)
    const sitelink = pickSitelink(entity);
    const wikipediaUrl = sitelink
      ? articleUrl(sitelink.lang, sitelink.title)
      : `https://www.wikidata.org/wiki/${encodeURIComponent(qid)}`;

    // try P18 image first (fastest)
    const p18 = wikidataP18Filename(entity);
    if (p18) return { imageUrl: commonsThumbUrl(p18), wikipediaUrl };

    // try Wikipedia lead thumbnail
    if (sitelink) {
      const thumb = await leadThumbnailUrl(sitelink.lang, sitelink.title);
      if (thumb) return { imageUrl: thumb, wikipediaUrl };

      // try the other language
      const altSite = sitelink.lang === "en" ? "eswiki" : "enwiki";
      const altLang: WikiLang = sitelink.lang === "en" ? "es" : "en";
      const altTitle = wikidataSitelinkArticleTitle(entity, altSite);
      if (altTitle && !titleShouldSkip(altTitle)) {
        const altThumb = await leadThumbnailUrl(altLang, altTitle);
        if (altThumb) return { imageUrl: altThumb, wikipediaUrl: articleUrl(altLang, altTitle) };
      }
    }
  }

  return null;
}

// ── path 2: Wikipedia OpenSearch batch ──────────────────────────────

async function viaWikipedia(
  folded: string,
  lang: WikiLang,
): Promise<{ imageUrl: string; wikipediaUrl: string } | null> {
  const os = await openSearchTitles(folded, lang, OPENSEARCH_LIMIT);
  const hints = TITLE_HINTS[folded] ?? [];
  const candidates = dedupeTitlesByFold([folded, ...hints, ...os]).slice(0, MAX_CANDIDATES);

  const batch = await batchCategoriesAndImages(lang, candidates);
  if (!batch) return null;

  for (const candidate of candidates) {
    const resolved = resolveTitle(candidate, batch.normalized, batch.redirects);
    const page = findPageByTitle(resolved, batch.pagesByTitle);
    if (!page || page.missing !== undefined) continue;

    // must have a thumbnail — we need an image to show
    const thumb = page.thumbnail?.source;
    if (!thumb) continue;

    // heuristic pre-filters (cheap, before the Wikidata round-trip)
    const pageTitle = page.title?.trim() ?? resolved;
    if (titleShouldSkip(pageTitle)) continue;
    const cats = page.categories?.map((c) => c.title) ?? [];
    if (categoriesShouldSkip(cats)) continue;

    // MUST confirm Animalia via Wikidata — skip if false or inconclusive
    if (!(await confirmArticleIsAnimal(pageTitle, lang))) continue;

    return { imageUrl: thumb, wikipediaUrl: articleUrl(lang, pageTitle) };
  }

  return null;
}

// ── public API ──────────────────────────────────────────────────────

/**
 * Resolves an animal name to an image + Wikipedia URL.
 * Every result is verified against kingdom Animalia before being returned.
 * Falls back to a random cat image when the animal cannot be confirmed.
 */
export async function lookupAnimalByName(name: string): Promise<AnimalLookupResult> {
  const trimmed = name.trim();
  const folded = foldQuery(name);

  // empty input → immediate fallback
  if (!trimmed || !folded) {
    recordServiceInteraction("AnimalLookup.lookup", { name: trimmed }, "Empty name");
    return catFallback(trimmed, FALLBACK_MSG);
  }

  const isNonAnimalQuery = NON_ANIMAL_QUERIES.has(folded);

  // path 1: Wikidata label search (confirms Animalia per entity)
  const wdHit = await viaWikidata(trimmed, folded);
  if (wdHit) {
    return {
      displayName: trimmed,
      imageUrl: wdHit.imageUrl,
      usedFallback: false,
      message: null,
      wikipediaUrl: wdHit.wikipediaUrl,
    };
  }

  // path 2: Wikipedia OpenSearch — English then Spanish (confirms Animalia per article)
  const wpHit =
    (await viaWikipedia(folded, "en")) ??
    (await viaWikipedia(folded, "es"));

  if (wpHit) {
    return {
      displayName: trimmed,
      imageUrl: wpHit.imageUrl,
      usedFallback: false,
      message: null,
      wikipediaUrl: wpHit.wikipediaUrl,
    };
  }

  // path 3: cat fallback
  recordServiceInteraction(
    "AnimalLookup.lookup",
    { name: trimmed, folded, source: "cat_fallback" },
    null,
  );
  return catFallback(
    trimmed,
    isNonAnimalQuery ? FALLBACK_NON_ANIMAL_MSG : FALLBACK_MSG,
  );
}

async function catFallback(displayName: string, message: string): Promise<AnimalLookupResult> {
  const imageUrl = (await fetchRandomCatImageUrl()) ?? "";
  return { displayName, imageUrl, usedFallback: true, message, wikipediaUrl: null };
}
