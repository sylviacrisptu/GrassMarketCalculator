import {
    loadMarketListings,
    saveMarketListings,
  } from "../storage/listingStorage.ts";
  import type { MarketListing } from "../types/listing.ts";
  
  type ListingsListener = (listings: MarketListing[]) => void;
  
  let listings = loadMarketListings();
  const listeners = new Set<ListingsListener>();
  
  export function getListings(): MarketListing[] {
    return [...listings];
  }
  
  export function addListing(listing: MarketListing): void {
    listings = [...listings, listing];
    commit();
  }
  
  export function updateListing(updatedListing: MarketListing): void {
    listings = listings.map((listing) =>
      listing.id === updatedListing.id ? updatedListing : listing
    );
  
    commit();
  }
  
  export function deleteListing(id: string): void {
    listings = listings.filter((listing) => listing.id !== id);
    commit();
  }
  
  export function toggleListingFavorite(id: string): void {
    listings = listings.map((listing) =>
      listing.id === id
        ? {
            ...listing,
            favorite: !listing.favorite,
            updatedAt: new Date().toISOString(),
          }
        : listing
    );
  
    commit();
  }
  
  export function subscribeToListings(listener: ListingsListener): () => void {
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