import {
    loadStorageItems,
    saveStorageItems,
  } from "../storage/storageItemStorage.ts";
  
  import type {
    StorageItem,
  } from "../types/storage.ts";
  
  type StorageListener = (
    items: StorageItem[],
  ) => void;
  
  let storageItems = loadStorageItems();
  
  const listeners =
    new Set<StorageListener>();
  
  function createId(): string {
    return (
      crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`
    );
  }
  
  function commit(): void {
    saveStorageItems(storageItems);
  
    for (const listener of listeners) {
      listener([...storageItems]);
    }
  }
  
  export function getStorageItems():
    StorageItem[] {
    return [...storageItems];
  }
  
  export function getStorageItem(
    id: string,
  ): StorageItem | undefined {
    return storageItems.find(
      (item) => item.id === id,
    );
  }
  
  export function addStorageItem(
    item: Omit<
      StorageItem,
      "id" | "createdAt" | "updatedAt"
    >,
  ): StorageItem {
    const now = new Date().toISOString();
  
    const created: StorageItem = {
      ...item,
      id: createId(),
      createdAt: now,
      updatedAt: now,
    };
  
    storageItems = [
      ...storageItems,
      created,
    ];
  
    commit();
  
    return created;
  }
  
  export function updateStorageItem(
    updated: StorageItem,
  ): void {
    storageItems = storageItems.map(
      (item) =>
        item.id === updated.id
          ? {
              ...updated,
              updatedAt:
                new Date().toISOString(),
            }
          : item,
    );
  
    commit();
  }
  
  export function setStorageQuantity(
    id: string,
    quantity: number,
  ): void {
    storageItems = storageItems.map(
      (item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(0, quantity),
              updatedAt:
                new Date().toISOString(),
            }
          : item,
    );
  
    commit();
  }
  
  export function adjustStorageQuantity(
    id: string,
    amount: number,
  ): void {
    const item = getStorageItem(id);
  
    if (!item) {
      return;
    }
  
    setStorageQuantity(
      id,
      item.quantity + amount,
    );
  }
  
  export function toggleStorageFavorite(
    id: string,
  ): void {
    storageItems = storageItems.map(
      (item) =>
        item.id === id
          ? {
              ...item,
              favorite: !item.favorite,
              updatedAt:
                new Date().toISOString(),
            }
          : item,
    );
  
    commit();
  }
  
  export function deleteStorageItem(
    id: string,
  ): void {
    storageItems = storageItems.filter(
      (item) => item.id !== id,
    );
  
    commit();
  }
  
  export function subscribeToStorage(
    listener: StorageListener,
  ): () => void {
    listeners.add(listener);
    listener([...storageItems]);
  
    return () => {
      listeners.delete(listener);
    };
  }