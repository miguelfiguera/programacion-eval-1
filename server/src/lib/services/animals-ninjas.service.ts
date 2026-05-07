import { HTTP_USER_AGENT } from "../wikimedia-http.js";
import { recordServiceInteraction } from "./request-log.service.js";

const NINJAS_ANIMALS_URL = "https://api.api-ninjas.com/v1/animals";

export type NinjasAnimalTaxonomy = {
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  scientific_name?: string;
};

export type NinjasAnimalRecord = {
  name: string;
  taxonomy?: NinjasAnimalTaxonomy;
  locations?: string[];
  characteristics?: Record<string, unknown>;
};

export type NinjasAnimalsOutcome =
  | { status: "ok"; records: NinjasAnimalRecord[] }
  | { status: "no_key" }
  | { status: "error"; message: string };

/**
 * Calls API Ninjas Animals (requires API_NINJAS_KEY). Empty array = no species matched the name.
 */
export async function fetchNinjasAnimals(commonName: string): Promise<NinjasAnimalsOutcome> {
  const key = process.env.API_NINJAS_KEY?.trim();
  if (!key) {
    return { status: "no_key" };
  }

  const q = commonName.trim();
  if (!q) {
    return { status: "ok", records: [] };
  }

  const url = `${NINJAS_ANIMALS_URL}?name=${encodeURIComponent(q)}`;
  const logPayload = { outbound: url };

  try {
    const res = await fetch(url, {
      headers: {
        "X-Api-Key": key,
        Accept: "application/json",
        "User-Agent": HTTP_USER_AGENT,
      },
    });

    if (!res.ok) {
      const msg = `API Ninjas HTTP ${res.status}`;
      recordServiceInteraction("AnimalsNinjasService.fetch", logPayload, msg);
      return { status: "error", message: msg };
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      recordServiceInteraction(
        "AnimalsNinjasService.fetch",
        logPayload,
        "Response JSON was not an array"
      );
      return { status: "error", message: "Invalid API Ninjas response" };
    }

    recordServiceInteraction("AnimalsNinjasService.fetch", logPayload, null);
    return { status: "ok", records: data as NinjasAnimalRecord[] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("AnimalsNinjasService.fetch", logPayload, message);
    return { status: "error", message };
  }
}

/** Picks the first row that is Animalia (or has no kingdom field). */
export function pickNinjaAnimalRecord(records: NinjasAnimalRecord[]): NinjasAnimalRecord | null {
  for (const r of records) {
    const k = r.taxonomy?.kingdom?.trim().toLowerCase();
    if (!k || k === "animalia") {
      return r;
    }
  }
  return null;
}

/** Best string to align Wikipedia image lookup with taxonomy. */
export function ninjaWikiLookupSeed(record: NinjasAnimalRecord): string {
  const sci = record.taxonomy?.scientific_name?.trim();
  if (sci) return sci;
  return record.name.trim();
}
