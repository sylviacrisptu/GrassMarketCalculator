export interface QuantityBreakdown {
    totalItems: number;
    stacks: number;
    singleChests: number;
    doubleChests: number;
    stacksWhole: number;
    remainderItems: number;
    singleChestsWhole: number;
    singleChestRemainderStacks: number;
    singleChestRemainderItems: number;
    doubleChestsWhole: number;
    doubleChestRemainderStacks: number;
    doubleChestRemainderItems: number;
  }
  
  const STACK_SIZE = 64;
  const SINGLE_CHEST_SIZE = 27 * STACK_SIZE;
  const DOUBLE_CHEST_SIZE = 54 * STACK_SIZE;
  
  function normalizeExpression(input: string): string {
    return input
      .trim()
      .toLowerCase()
  
      // Double chests: 1dc, 1 dc, 1 double chest
      .replace(
        /(\d+(?:\.\d+)?|\))\s*(?:double\s*chests?|dc)\b/g,
        `$1*${DOUBLE_CHEST_SIZE}`,
      )
  
      // Single chests: 1sc, 1 sc, 1 single chest
      .replace(
        /(\d+(?:\.\d+)?|\))\s*(?:single\s*chests?|sc)\b/g,
        `$1*${SINGLE_CHEST_SIZE}`,
      )
  
      // Stacks: 32.19s, 23 stacks, 4stx
      .replace(
        /(\d+(?:\.\d+)?|\))\s*(?:stacks?|stx|s)\b/g,
        `$1*${STACK_SIZE}`,
      )
  
      // Optional item labels
      .replace(/\bitems?\b/g, "")
  
      .replace(/\s+/g, " ")
      .trim();
  }
  
  function validateExpression(expression: string): void {
    if (!expression) {
      throw new Error("Enter a quantity expression.");
    }
  
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      throw new Error(
        "Use numbers, +, -, *, /, parentheses, and quantity suffixes only.",
      );
    }
  }
  
  function evaluateExpression(expression: string): number {
    validateExpression(expression);
  
    const result = Function(
      `"use strict"; return (${expression});`,
    )() as unknown;
  
    if (
      typeof result !== "number" ||
      !Number.isFinite(result)
    ) {
      throw new Error("The quantity expression did not produce a valid number.");
    }
  
    if (result < 0) {
      throw new Error("The final quantity cannot be negative.");
    }
  
    return result;
  }
  
  export function parseQuantityExpression(
    input: string,
  ): number {
    const normalized = normalizeExpression(input);
    return evaluateExpression(normalized);
  }
  
  export function createQuantityBreakdown(
    totalItems: number,
  ): QuantityBreakdown {
    const safeTotal = Math.max(0, totalItems);
  
    const stacksWhole = Math.floor(
      safeTotal / STACK_SIZE,
    );
  
    const remainderItems =
      safeTotal - stacksWhole * STACK_SIZE;
  
    const singleChestsWhole = Math.floor(
      safeTotal / SINGLE_CHEST_SIZE,
    );
  
    const singleChestRemainder =
      safeTotal -
      singleChestsWhole * SINGLE_CHEST_SIZE;
  
    const singleChestRemainderStacks =
      Math.floor(singleChestRemainder / STACK_SIZE);
  
    const singleChestRemainderItems =
      singleChestRemainder -
      singleChestRemainderStacks * STACK_SIZE;
  
    const doubleChestsWhole = Math.floor(
      safeTotal / DOUBLE_CHEST_SIZE,
    );
  
    const doubleChestRemainder =
      safeTotal -
      doubleChestsWhole * DOUBLE_CHEST_SIZE;
  
    const doubleChestRemainderStacks =
      Math.floor(doubleChestRemainder / STACK_SIZE);
  
    const doubleChestRemainderItems =
      doubleChestRemainder -
      doubleChestRemainderStacks * STACK_SIZE;
  
    return {
      totalItems: safeTotal,
      stacks: safeTotal / STACK_SIZE,
      singleChests: safeTotal / SINGLE_CHEST_SIZE,
      doubleChests: safeTotal / DOUBLE_CHEST_SIZE,
      stacksWhole,
      remainderItems,
      singleChestsWhole,
      singleChestRemainderStacks,
      singleChestRemainderItems,
      doubleChestsWhole,
      doubleChestRemainderStacks,
      doubleChestRemainderItems,
    };
  }