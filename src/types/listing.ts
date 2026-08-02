export type ListingType = "buying" | "selling";

export interface MarketListing {
  id: string;
  type: ListingType;
  item: string;
  quantity: number;
  grassPrice: number;
  pricePerItem: number;
  favorite: boolean;
  seller: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}