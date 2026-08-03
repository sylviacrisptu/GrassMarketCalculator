import type {
    CraftingRecipe,
    RecipeIngredient,
  } from "../types/recipe.ts";
  
  const STORAGE_KEY =
    "grass-market-calculator.recipes";
  
  interface LegacyRecipe {
    id?: unknown;
    outputItem?: unknown;
    outputQuantity?: unknown;
    ingredients?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  }
  
  function migrateIngredient(
    raw: unknown,
  ): RecipeIngredient | null {
    if (
      typeof raw !== "object" ||
      raw === null
    ) {
      return null;
    }
  
    const value =
      raw as Record<string, unknown>;
  
    const item =
      typeof value.item === "string"
        ? value.item.trim()
        : "";
  
    const quantity =
      Number(value.quantity);
  
    if (
      !item ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return null;
    }
  
    return {
      item,
      quantity,
    };
  }
  
  function migrateRecipe(
    raw: LegacyRecipe,
    index: number,
  ): CraftingRecipe | null {
    const outputItem =
      typeof raw.outputItem === "string"
        ? raw.outputItem.trim()
        : "";
  
    const outputQuantity =
      Number(raw.outputQuantity);
  
    if (
      !outputItem ||
      !Number.isFinite(outputQuantity) ||
      outputQuantity <= 0 ||
      !Array.isArray(raw.ingredients)
    ) {
      return null;
    }
  
    const ingredients =
      raw.ingredients
        .map(migrateIngredient)
        .filter(
          (
            ingredient,
          ): ingredient is RecipeIngredient =>
            ingredient !== null,
        );
  
    if (ingredients.length === 0) {
      return null;
    }
  
    const now =
      new Date().toISOString();
  
    return {
      id:
        typeof raw.id === "string" &&
        raw.id
          ? raw.id
          : `recipe-${Date.now()}-${index}`,
  
      outputItem,
      outputQuantity,
      ingredients,
  
      createdAt:
        typeof raw.createdAt === "string"
          ? raw.createdAt
          : now,
  
      updatedAt:
        typeof raw.updatedAt === "string"
          ? raw.updatedAt
          : now,
    };
  }
  
  export function loadRecipes():
    CraftingRecipe[] {
    const saved =
      localStorage.getItem(STORAGE_KEY);
  
    if (!saved) {
      return [];
    }
  
    try {
      const parsed =
        JSON.parse(saved) as unknown;
  
      if (!Array.isArray(parsed)) {
        return [];
      }
  
      const recipes = parsed
        .map((entry, index) =>
          migrateRecipe(
            entry as LegacyRecipe,
            index,
          ),
        )
        .filter(
          (
            recipe,
          ): recipe is CraftingRecipe =>
            recipe !== null,
        );
  
      saveRecipes(recipes);
  
      return recipes;
    } catch {
      return [];
    }
  }
  
  export function saveRecipes(
    recipes: CraftingRecipe[],
  ): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(recipes),
    );
  }