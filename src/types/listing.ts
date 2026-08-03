export type ListingType = "buying" | "selling";

export interface MarketListing {
  id: string;
  type: ListingType;
  item: string;

  /**
   * null means automatically choose an icon from the item name.
   * A string means use that exact built-in or custom icon.
   */
  iconId: string | null;

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