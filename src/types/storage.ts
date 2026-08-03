export interface StorageItem {
    id: string;
    item: string;
    iconId: string | null;
    quantity: number;
    favorite: boolean;
    notes: string;
    createdAt: string;
    updatedAt: string;
  }