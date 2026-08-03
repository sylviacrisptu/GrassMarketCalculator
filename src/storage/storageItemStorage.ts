import type { StorageItem } from "../types/storage.ts";

const STORAGE_KEY =
  "grass-market-calculator.storage-items";

interface LegacyStorageItem {
  id?: unknown;
  item?: unknown;
  iconId?: unknown;
  quantity?: unknown;
  favorite?: unknown;
  notes?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function migrateStorageItem(
  raw: LegacyStorageItem,
  index: number,
): StorageItem | null {
  const item =
    typeof raw.item === "string"
      ? raw.item.trim()
      : "";

  const quantity = Number(raw.quantity);

  if (
    !item ||
    !Number.isFinite(quantity) ||
    quantity < 0
  ) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id:
      typeof raw.id === "string" && raw.id
        ? raw.id
        : `storage-${Date.now()}-${index}`,

    item,

    iconId:
      typeof raw.iconId === "string" &&
      raw.iconId.trim()
        ? raw.iconId
        : null,

    quantity,
    favorite: raw.favorite === true,

    notes:
      typeof raw.notes === "string"
        ? raw.notes
        : "",

    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : now,

    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : now,
  };
}

export function loadStorageItems(): StorageItem[] {
  const saved =
    localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    const migrated = parsed
      .map((entry, index) =>
        migrateStorageItem(
          entry as LegacyStorageItem,
          index,
        ),
      )
      .filter(
        (entry): entry is StorageItem =>
          entry !== null,
      );

    saveStorageItems(migrated);

    return migrated;
  } catch {
    return [];
  }
}

export function saveStorageItems(
  items: StorageItem[],
): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items),
  );
}