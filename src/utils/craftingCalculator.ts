import type {
    CraftingRecipe,
    RequiredIngredient,
  } from "../types/recipe.ts";
  
  import type {
    StorageItem,
  } from "../types/storage.ts";
  
  
  interface CalculateRequirementsOptions {
    builtInRecipes: CraftingRecipe[];
    customRecipes: CraftingRecipe[];
    storageItems: StorageItem[];
    outputItem: string;
    outputQuantity: number;
  }
  
  
  function normalizeItem(
    item: string,
  ): string {
    return item
      .trim()
      .toLowerCase();
  }
  
  
  export function calculateCraftingRequirements(
    options: CalculateRequirementsOptions,
  ): RequiredIngredient[] {
    const recipeByOutput =
      new Map<string, CraftingRecipe>();
  
    for (
      const recipe of
      options.builtInRecipes
    ) {
      const key =
        normalizeItem(
          recipe.outputItem,
        );
  
      if (!recipeByOutput.has(key)) {
        recipeByOutput.set(
          key,
          recipe,
        );
      }
    }
  
    for (
      const recipe of
      options.customRecipes
    ) {
      recipeByOutput.set(
        normalizeItem(
          recipe.outputItem,
        ),
        recipe,
      );
    }
  
    const rawRequirements =
      new Map<
        string,
        {
          item: string;
          quantity: number;
        }
      >();
  
  
    function addRawIngredient(
      item: string,
      quantity: number,
    ): void {
      const key =
        normalizeItem(item);
  
      const existing =
        rawRequirements.get(key);
  
      if (existing) {
        existing.quantity += quantity;
        return;
      }
  
      rawRequirements.set(
        key,
        {
          item,
          quantity,
        },
      );
    }
  
  
    function expandItem(
      item: string,
      quantityNeeded: number,
      recipePath: Set<string>,
    ): void {
      const key =
        normalizeItem(item);
  
      const recipe =
        recipeByOutput.get(key);
  
      if (!recipe) {
        addRawIngredient(
          item,
          quantityNeeded,
        );
  
        return;
      }
  
      if (recipePath.has(key)) {
        throw new Error(
          `Circular recipe detected at ${item}.`,
        );
      }
  
      const craftsNeeded =
        Math.ceil(
          quantityNeeded /
            recipe.outputQuantity,
        );
  
      const nextPath =
        new Set(recipePath);
  
      nextPath.add(key);
  
      for (
        const ingredient of
        recipe.ingredients
      ) {
        expandItem(
          ingredient.item,
          ingredient.quantity *
            craftsNeeded,
          nextPath,
        );
      }
    }
  
  
    expandItem(
      options.outputItem,
      options.outputQuantity,
      new Set<string>(),
    );
  
    const storageByItem =
      new Map<string, number>();
  
    for (
      const storageItem of
      options.storageItems
    ) {
      const key =
        normalizeItem(
          storageItem.item,
        );
  
      storageByItem.set(
        key,
        (storageByItem.get(key) ?? 0) +
          storageItem.quantity,
      );
    }
  
    return Array.from(
      rawRequirements.values(),
    )
      .map(
        (
          requirement,
        ): RequiredIngredient => {
          const owned =
            storageByItem.get(
              normalizeItem(
                requirement.item,
              ),
            ) ?? 0;
  
          return {
            item:
              requirement.item,
  
            required:
              requirement.quantity,
  
            owned,
  
            missing:
              Math.max(
                0,
                requirement.quantity -
                  owned,
              ),
          };
        },
      )
      .sort((a, b) =>
        a.item.localeCompare(
          b.item,
        ),
      );
  }