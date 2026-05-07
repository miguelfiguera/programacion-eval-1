import { recordServiceInteraction } from "./request-log.service.js";
import { fetchWithWikimediaRetry } from "../wikimedia-http.js";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
/** Kingdom Animalia — https://www.wikidata.org/wiki/Q729 */
const WIKIDATA_ANIMALIA = "Q729";

const WIKI_ORIGINS_FOR_WIKIDATA = {
  en: "https://en.wikipedia.org",
  es: "https://es.wikipedia.org",
} as const;

export type WikiLangForWikidata = keyof typeof WIKI_ORIGINS_FOR_WIKIDATA;

type WikidataEntity = {
  missing?: string;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
};

type WbGetEntitiesResponse = {
  entities?: Record<string, WikidataEntity>;
  error?: { info?: string };
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function claimItemIds(entity: WikidataEntity | undefined, property: string): string[] {
  const claims = entity?.claims?.[property];
  if (!claims) return [];
  const out: string[] = [];
  for (const c of claims) {
    const v = c.mainsnak?.datavalue?.value;
    if (v && typeof v === "object" && "id" in v && typeof (v as { id?: string }).id === "string") {
      out.push((v as { id: string }).id);
    }
  }
  return out;
}

/**
 * Wikidata Q-id from a Wikipedia article title (follows redirects).
 */
export async function wikipediaTitleToWikidataId(
  title: string,
  lang: WikiLangForWikidata
): Promise<string | null> {
  const enc = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `${WIKI_ORIGINS_FOR_WIKIDATA[lang]}/w/api.php?action=query&format=json&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${enc}`;
  const logPayload = { title, lang, outbound: url };

  try {
    const res = await fetchWithWikimediaRetry(url, "WikidataAnimalService.http", logPayload);
    if (!res) {
      recordServiceInteraction("WikidataAnimalService.sitelink", logPayload, "Retries exhausted");
      return null;
    }
    if (!res.ok) {
      recordServiceInteraction("WikidataAnimalService.sitelink", logPayload, `HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string }; missing?: string }> };
    };
    const pages = data.query?.pages;
    const first = pages ? Object.values(pages)[0] : undefined;
    if (first?.missing !== undefined) {
      recordServiceInteraction("WikidataAnimalService.sitelink", logPayload, "Missing page");
      return null;
    }
    const q = first?.pageprops?.wikibase_item?.trim();
    if (!q) {
      recordServiceInteraction("WikidataAnimalService.sitelink", logPayload, "No wikibase_item");
      return null;
    }
    recordServiceInteraction("WikidataAnimalService.sitelink", logPayload, null);
    return q;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("WikidataAnimalService.sitelink", logPayload, message);
    return null;
  }
}

async function wbGetEntitiesBatch(
  ids: string[],
  logPayload: Record<string, unknown>
): Promise<Record<string, WikidataEntity> | null> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const batch = unique.slice(0, 50).join("|");
  const url = `${WIKIDATA_API}?action=wbgetentities&format=json&ids=${batch}&props=claims`;

  const res = await fetchWithWikimediaRetry(url, "WikidataAnimalService.http", {
    ...logPayload,
    batchSize: unique.length,
  });
  if (!res) {
    recordServiceInteraction("WikidataAnimalService.wbgetentities", logPayload, "Retries exhausted");
    return null;
  }
  if (!res.ok) {
    recordServiceInteraction(
      "WikidataAnimalService.wbgetentities",
      logPayload,
      `HTTP ${res.status}`
    );
    return null;
  }
  const data = (await res.json()) as WbGetEntitiesResponse;
  if (data.error) {
    recordServiceInteraction(
      "WikidataAnimalService.wbgetentities",
      logPayload,
      data.error.info ?? "Wikidata error object"
    );
    return null;
  }
  const entities = data.entities ?? {};
  for (const qid of unique) {
    const e = entities[qid];
    if (!e || e.missing !== undefined) {
      recordServiceInteraction(
        "WikidataAnimalService.wbgetentities",
        { ...logPayload, missingId: qid },
        "Entity missing in response"
      );
      return null;
    }
  }
  await delay(80);
  return entities;
}

/**
 * True if the item is kingdom Animalia, or can reach it by climbing parent taxon (P171),
 * with limited hops via P31/P279 when P171 is missing (covers common-name items like domestic cat).
 * False when exhausted without reaching Animalia. Null when Wikidata could not be queried reliably.
 */
export async function wikidataItemIsUnderAnimalia(startQid: string): Promise<boolean | null> {
  const logPayload = { startQid, outbound: WIKIDATA_API };
  const visited = new Set<string>();
  let frontier: string[] = [startQid];
  let expansionsWithoutP171 = 0;
  const MAX_EXPANSIONS_NO_P171 = 14;
  const MAX_ENTITIES = 52;

  try {
    let processed = 0;
    let stoppedForBridgeCap = false;
    while (frontier.length > 0 && processed < MAX_ENTITIES) {
      const batchIds = frontier.filter((id) => !visited.has(id));
      frontier = [];
      if (batchIds.length === 0) break;

      const entities = await wbGetEntitiesBatch(batchIds, logPayload);
      if (!entities) return null;

      for (const qid of batchIds) {
        if (visited.has(qid)) continue;
        visited.add(qid);
        processed++;
        if (qid === WIKIDATA_ANIMALIA) {
          recordServiceInteraction("WikidataAnimalService.reachable", logPayload, null);
          return true;
        }
      }

      const nextP171: string[] = [];
      const nextTaxonBridge: string[] = [];

      for (const qid of batchIds) {
        const entity = entities[qid];
        const p171 = claimItemIds(entity, "P171");
        if (p171.length > 0) {
          for (const p of p171) {
            if (!visited.has(p)) nextP171.push(p);
          }
          continue;
        }
        const p31 = claimItemIds(entity, "P31");
        const p279 = claimItemIds(entity, "P279");
        for (const x of [...p31, ...p279]) {
          if (!visited.has(x)) nextTaxonBridge.push(x);
        }
      }

      if (nextP171.length > 0) {
        frontier.push(...nextP171);
        continue;
      }

      if (nextTaxonBridge.length === 0) break;
      expansionsWithoutP171++;
      if (expansionsWithoutP171 > MAX_EXPANSIONS_NO_P171) {
        stoppedForBridgeCap = true;
        break;
      }
      frontier.push(...nextTaxonBridge);
    }

    if (stoppedForBridgeCap || processed >= MAX_ENTITIES) {
      recordServiceInteraction(
        "WikidataAnimalService.reachable",
        logPayload,
        stoppedForBridgeCap
          ? "Stopped early: P31/P279 bridge depth cap (inconclusive)"
          : "Stopped early: entity visit cap (inconclusive)"
      );
      return null;
    }

    recordServiceInteraction(
      "WikidataAnimalService.reachable",
      logPayload,
      "No path to kingdom Animalia (P171 / taxon bridge)"
    );
    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("WikidataAnimalService.reachable", logPayload, message);
    return null;
  }
}

/**
 * Resolves a Wikipedia article title to whether it represents a taxon / organism under Animalia.
 */
export async function wikipediaArticleIsAnimalTaxon(
  pageTitle: string,
  lang: WikiLangForWikidata
): Promise<boolean | null> {
  const qid = await wikipediaTitleToWikidataId(pageTitle, lang);
  if (!qid) return null;
  return wikidataItemIsUnderAnimalia(qid);
}
