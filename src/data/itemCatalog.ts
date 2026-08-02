export interface ItemCatalog {
    items: string[];
    aliases: Record<string, string>;
  }
  
  function normalizeName(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");
  }
  
  export async function loadItemCatalog(): Promise<ItemCatalog> {
    const base = import.meta.env.BASE_URL;
  
    const [itemsResponse, aliasesResponse] = await Promise.all([
      fetch(`${base}data/items_1.19.2.txt`),
      fetch(`${base}data/item_aliases_1.19.2.json`),
    ]);
  
    if (!itemsResponse.ok) {
      throw new Error("Could not load items_1.19.2.txt");
    }
  
    if (!aliasesResponse.ok) {
      throw new Error("Could not load item_aliases_1.19.2.json");
    }
  
    const itemText = await itemsResponse.text();
    const rawAliases = (await aliasesResponse.json()) as Record<string, string>;
  
    const items = itemText
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  
    const aliases: Record<string, string> = {};
  
    for (const item of items) {
      aliases[normalizeName(item)] = item;
    }
  
    for (const [alias, canonicalName] of Object.entries(rawAliases)) {
      aliases[normalizeName(alias)] = canonicalName;
    }
  
    return { items, aliases };
  }
  
  export function resolveItemName(
    input: string,
    catalog: ItemCatalog,
  ): string | null {
    const normalized = normalizeName(input);
  
    if (!normalized) {
      return null;
    }
  
    return catalog.aliases[normalized] ?? null;
  }
  
  export function searchItems(
    query: string,
    catalog: ItemCatalog,
    limit = 20,
  ): string[] {
    const normalized = normalizeName(query);
  
    if (!normalized) {
      return catalog.items.slice(0, limit);
    }
  
    const exactAlias = catalog.aliases[normalized];
    const results: string[] = [];
  
    if (exactAlias) {
      results.push(exactAlias);
    }
  
    const startsWith = catalog.items.filter((item) =>
      normalizeName(item).startsWith(normalized),
    );
  
    const wordMatches = catalog.items.filter((item) =>
      normalizeName(item)
        .split(" ")
        .some((word) => word.startsWith(normalized)),
    );
  
    const contains = catalog.items.filter((item) =>
      normalizeName(item).includes(normalized),
    );
  
    for (const item of [...startsWith, ...wordMatches, ...contains]) {
      if (!results.includes(item)) {
        results.push(item);
      }
  
      if (results.length >= limit) {
        break;
      }
    }
  
    return results;
  }