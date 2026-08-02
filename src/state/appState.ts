import {
    loadMarketListings,
    saveMarketListings,
  } from "../storage/listingStorage.ts";
  
  import type {
    MarketListing,
  } from "../types/listing.ts";
  
  type ListingsListener = (
    listings: MarketListing[],
  ) => void;
  
  let listings = loadMarketListings();
  const listeners = new Set<ListingsListener>();
  
  function createId(): string {
    return (
      crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
  
  export function getListings(): MarketListing[] {
    return [...listings];
  }
  
  export function getListing(
    id: string,
  ): MarketListing | undefined {
    return listings.find((listing) => listing.id === id);
  }
  
  export function addListing(
    listing: MarketListing,
  ): void {
    listings = [...listings, listing];
    commit();
  }
  
  export function updateListing(
    updatedListing: MarketListing,
  ): void {
    listings = listings.map((listing) =>
      listing.id === updatedListing.id
        ? {
            ...updatedListing,
            updatedAt: new Date().toISOString(),
          }
        : listing,
    );
  
    commit();
  }
  
  export function duplicateListing(
    id: string,
  ): MarketListing | null {
    const original = getListing(id);
  
    if (!original) {
      return null;
    }
  
    const now = new Date().toISOString();
  
    const duplicate: MarketListing = {
      ...original,
      id: createId(),
      favorite: false,
      createdAt: now,
      updatedAt: now,
    };
  
    listings = [...listings, duplicate];
    commit();
  
    return duplicate;
  }
  
  export function deleteListing(id: string): void {
    listings = listings.filter(
      (listing) => listing.id !== id,
    );
  
    commit();
  }
  
  export function toggleListingFavorite(
    id: string,
  ): void {
    listings = listings.map((listing) =>
      listing.id === id
        ? {
            ...listing,
            favorite: !listing.favorite,
            updatedAt: new Date().toISOString(),
          }
        : listing,
    );
  
    commit();
  }
  
  export function subscribeToListings(
    listener: ListingsListener,
  ): () => void {
    listeners.add(listener);
    listener(getListings());
  
    return () => {
      listeners.delete(listener);
    };
  }
  
  function commit(): void {
    saveMarketListings(listings);
  
    for (const listener of listeners) {
      listener(getListings());
    }
  }