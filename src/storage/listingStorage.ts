import type {
    ListingType,
    MarketListing,
  } from "../types/listing.ts";
  
  const STORAGE_KEY = "grass-market-calculator.market-listings";
  
  interface LegacyListing {
    id?: unknown;
    type?: unknown;
    item?: unknown;
    quantity?: unknown;
    grassPrice?: unknown;
    pricePerItem?: unknown;
    favorite?: unknown;
    universalPrice?: unknown;
    seller?: unknown;
    shopCoordinates?: unknown;
    availableStock?: unknown;
    maximumPurchases?: unknown;
    restockDetails?: unknown;
    notes?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  }
  
  function numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
  
    const parsed = Number(value);
  
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
  
    return parsed;
  }
  
  function normalizeType(value: unknown): ListingType {
    return value === "selling" ? "selling" : "buying";
  }
  
  function migrateListing(
    raw: LegacyListing,
    index: number,
  ): MarketListing | null {
    const item =
      typeof raw.item === "string" ? raw.item.trim() : "";
  
    const quantity = Number(raw.quantity);
    const grassPrice = Number(raw.grassPrice);
  
    if (
      !item ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(grassPrice) ||
      grassPrice <= 0
    ) {
      return null;
    }
  
    const now = new Date().toISOString();
  
    return {
      id:
        typeof raw.id === "string" && raw.id
          ? raw.id
          : `migrated-${Date.now()}-${index}`,
  
      type: normalizeType(raw.type),
      item,
  
      quantity,
      grassPrice,
      pricePerItem: grassPrice / quantity,
  
      favorite: raw.favorite === true,
      universalPrice: raw.universalPrice === true,
  
      seller:
        typeof raw.seller === "string" ? raw.seller : "",
  
      shopCoordinates:
        typeof raw.shopCoordinates === "string"
          ? raw.shopCoordinates
          : "",
  
      availableStock: numberOrNull(raw.availableStock),
      maximumPurchases: numberOrNull(raw.maximumPurchases),
  
      restockDetails:
        typeof raw.restockDetails === "string"
          ? raw.restockDetails
          : "",
  
      notes:
        typeof raw.notes === "string" ? raw.notes : "",
  
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
  
  export function loadMarketListings(): MarketListing[] {
    const saved = localStorage.getItem(STORAGE_KEY);
  
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
          migrateListing(entry as LegacyListing, index),
        )
        .filter(
          (entry): entry is MarketListing => entry !== null,
        );
  
      saveMarketListings(migrated);
      return migrated;
    } catch {
      return [];
    }
  }
  
  export function saveMarketListings(
    listings: MarketListing[],
  ): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(listings),
    );
  }