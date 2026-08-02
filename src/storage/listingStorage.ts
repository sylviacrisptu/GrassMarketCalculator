import type { MarketListing } from "../types/listing.ts";

const STORAGE_KEY = "grass-market-calculator.market-listings";

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

    return parsed as MarketListing[];
  } catch {
    return [];
  }
}

export function saveMarketListings(listings: MarketListing[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
}