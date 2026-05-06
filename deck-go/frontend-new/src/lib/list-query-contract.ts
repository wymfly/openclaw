import {
  deckGoListQueryContract,
  type DeckGoListQueryId,
} from "../../../contracts/generated/ts/deck-list-queries.generated";

type ListQuery = (typeof deckGoListQueryContract.queries)[number];
type ListQueryParameter = ListQuery["parameters"][number];

export type ListQueryValue = string | number | boolean | readonly string[] | null | undefined;
export type ListQueryValues = Record<string, ListQueryValue>;

export function getListQueryContract(id: DeckGoListQueryId): ListQuery {
  const query = deckGoListQueryContract.queries.find((item) => item.id === id);
  if (!query) {
    throw new Error(`unknown list query contract: ${id}`);
  }
  return query;
}

function serializeValue(parameter: ListQueryParameter, value: ListQueryValue): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (parameter.type === "number") {
    return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
  }
  if (parameter.type === "boolean") {
    const trueValue = "trueValue" in parameter ? parameter.trueValue : undefined;
    if (trueValue) {
      return value === true ? trueValue : null;
    }
    return typeof value === "boolean" ? String(value) : null;
  }
  if (parameter.type === "string-array") {
    if (!Array.isArray(value)) {
      return null;
    }
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items.join(",") : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

export function buildListQueryParams(
  id: DeckGoListQueryId,
  values: ListQueryValues,
): URLSearchParams {
  const query = getListQueryContract(id);
  const search = new URLSearchParams();
  for (const parameter of query.parameters) {
    const serialized = serializeValue(parameter, values[parameter.id]);
    if (serialized !== null) {
      search.set(parameter.param, serialized);
    }
  }
  return search;
}

export function buildListQueryString(id: DeckGoListQueryId, values: ListQueryValues): string {
  return buildListQueryParams(id, values).toString();
}

export function withListQuery(
  path: string,
  id: DeckGoListQueryId,
  values: ListQueryValues,
): string {
  const query = buildListQueryString(id, values);
  return query ? `${path}?${query}` : path;
}
