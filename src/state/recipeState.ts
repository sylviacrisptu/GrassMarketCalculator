import {
    loadRecipes,
    saveRecipes,
  } from "../storage/recipeStorage.ts";
  
  import type {
    CraftingRecipe,
  } from "../types/recipe.ts";
  
  type RecipeListener = (
    recipes: CraftingRecipe[],
  ) => void;
  
  let recipes = loadRecipes();
  
  const listeners =
    new Set<RecipeListener>();
  
  function createId(): string {
    return (
      crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`
    );
  }
  
  function commit(): void {
    saveRecipes(recipes);
  
    for (const listener of listeners) {
      listener([...recipes]);
    }
  }
  
  export function getRecipes():
    CraftingRecipe[] {
    return [...recipes];
  }
  
  export function getRecipe(
    id: string,
  ): CraftingRecipe | undefined {
    return recipes.find(
      (recipe) => recipe.id === id,
    );
  }
  
  export function findRecipeForItem(
    item: string,
  ): CraftingRecipe | undefined {
    const normalized =
      item.trim().toLowerCase();
  
    return recipes.find(
      (recipe) =>
        recipe.outputItem
          .toLowerCase() === normalized,
    );
  }
  
  export function addRecipe(
    value: Omit<
      CraftingRecipe,
      "id" | "createdAt" | "updatedAt"
    >,
  ): CraftingRecipe {
    const now =
      new Date().toISOString();
  
    const recipe: CraftingRecipe = {
      ...value,
      id: createId(),
      createdAt: now,
      updatedAt: now,
    };
  
    recipes = [
      ...recipes,
      recipe,
    ];
  
    commit();
  
    return recipe;
  }
  
  export function updateRecipe(
    updated: CraftingRecipe,
  ): void {
    recipes = recipes.map(
      (recipe) =>
        recipe.id === updated.id
          ? {
              ...updated,
              updatedAt:
                new Date().toISOString(),
            }
          : recipe,
    );
  
    commit();
  }
  
  export function deleteRecipe(
    id: string,
  ): void {
    recipes = recipes.filter(
      (recipe) => recipe.id !== id,
    );
  
    commit();
  }
  
  export function subscribeToRecipes(
    listener: RecipeListener,
  ): () => void {
    listeners.add(listener);
    listener([...recipes]);
  
    return () => {
      listeners.delete(listener);
    };
  }