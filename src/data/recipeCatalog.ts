import type {
    CraftingRecipe,
  } from "../types/recipe.ts";
  
  
  export interface BuiltInRecipeCatalog {
    version: string;
    generatedAt: string;
    recipes: CraftingRecipe[];
  }
  
  
  let cachedCatalog:
    BuiltInRecipeCatalog | null = null;
  
  
  function isRecipe(
    value: unknown,
  ): value is CraftingRecipe {
    if (
      typeof value !== "object" ||
      value === null
    ) {
      return false;
    }
  
    const recipe =
      value as Partial<CraftingRecipe>;
  
    return (
      typeof recipe.id === "string" &&
      typeof recipe.outputItem === "string" &&
      typeof recipe.outputQuantity === "number" &&
      recipe.outputQuantity > 0 &&
      Array.isArray(recipe.ingredients)
    );
  }
  
  
  export async function loadBuiltInRecipeCatalog():
    Promise<BuiltInRecipeCatalog> {
    if (cachedCatalog) {
      return cachedCatalog;
    }
  
    const url =
      `${import.meta.env.BASE_URL}` +
      "data/recipes-1.19.2.json";
  
    const response = await fetch(
      url,
      {
        cache: "no-cache",
      },
    );
  
    if (!response.ok) {
      throw new Error(
        `Could not load Minecraft 1.19.2 recipes: ${response.status}`,
      );
    }
  
    const parsed =
      (await response.json()) as {
        version?: unknown;
        generatedAt?: unknown;
        recipes?: unknown;
      };
  
    cachedCatalog = {
      version:
        typeof parsed.version === "string"
          ? parsed.version
          : "1.19.2",
  
      generatedAt:
        typeof parsed.generatedAt === "string"
          ? parsed.generatedAt
          : "",
  
      recipes:
        Array.isArray(parsed.recipes)
          ? parsed.recipes.filter(isRecipe)
          : [],
    };
  
    return cachedCatalog;
  }
  
  
  export async function getBuiltInRecipes():
    Promise<CraftingRecipe[]> {
    const catalog =
      await loadBuiltInRecipeCatalog();
  
    return [...catalog.recipes];
  }
  
  
  export async function findBuiltInRecipesForItem(
    itemName: string,
  ): Promise<CraftingRecipe[]> {
    const catalog =
      await loadBuiltInRecipeCatalog();
  
    const normalized =
      itemName.trim().toLowerCase();
  
    return catalog.recipes.filter(
      (recipe) =>
        recipe.outputItem
          .trim()
          .toLowerCase() === normalized,
    );
  }
  
  
  export function clearBuiltInRecipeCache():
    void {
    cachedCatalog = null;
  }