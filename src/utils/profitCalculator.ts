import type {
    ListingType,
    MarketListing,
  } from "../types/listing.ts";
  
  export interface ListingAllocation {
    listing: MarketListing;
    quantity: number;
    bundles: number;
    totalGrass: number;
  }
  
  export interface MarketPlan {
    requestedQuantity: number;
    fulfilledQuantity: number;
    totalGrass: number;
    allocations: ListingAllocation[];
    complete: boolean;
  }
  
  function getListingCapacity(
    listing: MarketListing,
  ): number {
    if (listing.universalPrice) {
      return Number.POSITIVE_INFINITY;
    }
  
    const stockCapacity =
      listing.availableStock ?? Number.POSITIVE_INFINITY;
  
    const purchaseCapacity =
      listing.maximumPurchases === null
        ? Number.POSITIVE_INFINITY
        : listing.maximumPurchases * listing.quantity;
  
    return Math.min(
      stockCapacity,
      purchaseCapacity,
    );
  }
  
  function createPlan(
    listings: MarketListing[],
    quantity: number,
    type: ListingType,
  ): MarketPlan {
    const sorted = listings
      .filter(
        (listing) =>
          listing.type === type &&
          listing.quantity > 0 &&
          listing.pricePerItem >= 0,
      )
      .sort((a, b) =>
        type === "buying"
          ? a.pricePerItem - b.pricePerItem
          : b.pricePerItem - a.pricePerItem,
      );
  
    const allocations: ListingAllocation[] = [];
  
    let remaining = quantity;
    let totalGrass = 0;
  
    for (const listing of sorted) {
      if (remaining <= 0) {
        break;
      }
  
      const capacity =
        getListingCapacity(listing);
  
      if (capacity <= 0) {
        continue;
      }
  
      const allocatedQuantity =
        Math.min(remaining, capacity);
  
      const allocationGrass =
        allocatedQuantity * listing.pricePerItem;
  
      allocations.push({
        listing,
        quantity: allocatedQuantity,
        bundles:
          allocatedQuantity / listing.quantity,
        totalGrass: allocationGrass,
      });
  
      remaining -= allocatedQuantity;
      totalGrass += allocationGrass;
    }
  
    const fulfilledQuantity =
      quantity - remaining;
  
    return {
      requestedQuantity: quantity,
      fulfilledQuantity,
      totalGrass,
      allocations,
      complete:
        remaining <= Math.max(1e-9, quantity * 1e-12),
    };
  }
  
  export function calculateAcquisitionPlan(
    listings: MarketListing[],
    quantity: number,
  ): MarketPlan {
    return createPlan(
      listings,
      quantity,
      "buying",
    );
  }
  
  export function calculateRevenuePlan(
    listings: MarketListing[],
    quantity: number,
  ): MarketPlan {
    return createPlan(
      listings,
      quantity,
      "selling",
    );
  }