export interface ParsedListing {
    quantity: number;
    grassPrice: number;
    pricePerItem: number;
  }
  
  function parsePositiveNumber(value: string): number {
    const parsed = Number(value.trim());
  
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error("Quantity and price must be greater than zero.");
    }
  
    return parsed;
  }
  
  export function parseListingExpression(input: string): ParsedListing {
    const normalized = input
      .trim()
      .toLowerCase()
      .replace(/grass blocks?/g, "g")
      .replace(/\bgb\b/g, "g")
      .replace(/\bgrass\b/g, "g")
      .replace(/\s+/g, " ");
  
    if (!normalized) {
      throw new Error("Enter a listing such as 12 for 21g.");
    }
  
    const quantityThenPrice = normalized.match(
      /^(\d+(?:\.\d+)?)\s*(?:items?)?\s*(?:for|:|\/)\s*(\d+(?:\.\d+)?)\s*g$/,
    );
  
    if (quantityThenPrice) {
      const quantity = parsePositiveNumber(quantityThenPrice[1]);
      const grassPrice = parsePositiveNumber(quantityThenPrice[2]);
  
      return {
        quantity,
        grassPrice,
        pricePerItem: grassPrice / quantity,
      };
    }
  
    const priceThenQuantity = normalized.match(
      /^(\d+(?:\.\d+)?)\s*g\s*(?:for|:|\/)\s*(\d+(?:\.\d+)?)\s*(?:items?)?$/,
    );
  
    if (priceThenQuantity) {
      const grassPrice = parsePositiveNumber(priceThenQuantity[1]);
      const quantity = parsePositiveNumber(priceThenQuantity[2]);
  
      return {
        quantity,
        grassPrice,
        pricePerItem: grassPrice / quantity,
      };
    }
  
    throw new Error(
      'Could not understand that listing. Try "12 for 21g" or "21g for 12".',
    );
  }