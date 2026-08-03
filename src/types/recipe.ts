export interface RecipeIngredient {
    item: string;
    quantity: number;
  }
  
  export interface CraftingRecipe {
    id: string;
    outputItem: string;
    outputQuantity: number;
    ingredients: RecipeIngredient[];
    createdAt: string;
    updatedAt: string;
  }
  
  export interface RequiredIngredient {
    item: string;
    required: number;
    owned: number;
    missing: number;
  }