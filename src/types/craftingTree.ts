export interface CraftingTreeNode {
    id: string;
    item: string;
  
    requiredQuantity: number;
    ownedQuantity: number;
    missingQuantity: number;
  
    outputQuantity: number;
    craftsNeeded: number;
  
    recipeCount: number;
    selectedRecipeIndex: number;
  
    isRawMaterial: boolean;
    children: CraftingTreeNode[];
  }