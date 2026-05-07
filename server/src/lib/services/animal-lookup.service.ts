import type { AnimalLookupResult } from "../../types/animal.types.js";
import { fetchRandomCatImageUrl } from "./cat-api.service.js";
import { recordServiceInteraction } from "./request-log.service.js";

const USER_AGENT = "EvalHomework/1.0 (educational; contact student)";
const WIKI_API =
  "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=640&redirects=1&titles=";

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

/**
 * Requests a thumbnail URL from Wikipedia's public API for the given title.
 * @returns source URL or null if the page has no image or is missing.
 */
async function wikipediaThumbnailUrl(
  animalName: string
): Promise<{ title: string; url: string | null }> {
  const titleParam = encodeURIComponent(animalName.trim());
  const url = `${WIKI_API}${titleParam}`;
  const logPayload = { animalName: animalName.trim(), outbound: url };

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      recordServiceInteraction(
        "AnimalLookupService.wikipedia",
        logPayload,
        `Wikipedia HTTP ${res.status}`
      );
      return { title: animalName.trim(), url: null };
    }

    const data = (await res.json()) as WikiQueryResponse;
    const pages = data.query?.pages;
    if (!pages) {
      recordServiceInteraction(
        "AnimalLookupService.wikipedia",
        logPayload,
        "No pages key in Wikipedia JSON"
      );
      return { title: animalName.trim(), url: null };
    }

    const first = Object.values(pages)[0];
    if (!first || first.missing !== undefined || !first.thumbnail?.source) {
      recordServiceInteraction(
        "AnimalLookupService.wikipedia",
        logPayload,
        "No thumbnail for this title (missing page or no image)"
      );
      return {
        title: first?.title ?? animalName.trim(),
        url: null,
      };
    }

    recordServiceInteraction("AnimalLookupService.wikipedia", logPayload, null);
    return { title: first.title ?? animalName.trim(), url: first.thumbnail.source };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordServiceInteraction("AnimalLookupService.wikipedia", logPayload, message);
    return { title: animalName.trim(), url: null };
  }
}

const FALLBACK_MESSAGE_ES =
  "Ups, no lo pudimos encontrar, pero aqui tienes un gatito.";

/**
 * Resolves an animal name to an image: tries Wikipedia first, then TheCatAPI.
 * This function always returns a result object; on total failure imageUrl may be empty string (caller should handle).
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

  const wiki = await wikipediaThumbnailUrl(trimmed);
  if (wiki.url) {
    return {
      displayName: wiki.title,
      imageUrl: wiki.url,
      usedFallback: false,
      message: null,
    };
  }

  const catUrl = await fetchRandomCatImageUrl();
  recordServiceInteraction(
    "AnimalLookupService.lookup",
    { name: trimmed, source: "thecatapi_fallback" },
    null
  );
  return {
    displayName: wiki.title,
    imageUrl: catUrl ?? "",
    usedFallback: true,
    message: FALLBACK_MESSAGE_ES,
  };
}
