export type ListingType = "buying" | "selling";

export interface MarketListing {
  id: string;
  type: ListingType;
  item: string;

  quantity: number;
  grassPrice: number;
  pricePerItem: number;

  favorite: boolean;
  universalPrice: boolean;

  seller: string;
  shopCoordinates: string;
  availableStock: number | null;
  maximumPurchases: number | null;
  restockDetails: string;
  notes: string;

  createdAt: string;
  updatedAt: string;
}