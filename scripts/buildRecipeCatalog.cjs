const fs = require("node:fs");
const path = require("node:path");
const minecraftData = require("minecraft-data");

const VERSION = "1.19.2";

const OUTPUT_PATH = path.resolve(
  __dirname,
  "../public/data/recipes-1.19.2.json",
);

const mcData = minecraftData(VERSION);

if (!mcData) {
  throw new Error(
    `Minecraft data could not be loaded for ${VERSION}.`,
  );
}

const itemById = new Map();

for (const item of Object.values(mcData.items ?? {})) {
  if (
    item &&
    typeof item === "object" &&
    Number.isFinite(item.id)
  ) {
    itemById.set(item.id, item);
  }
}

function getItemId(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  if (Array.isArray(value)) {
    if (typeof value[0] === "number") {
      return value[0];
    }

    for (const option of value) {
      const optionId = getItemId(option);

      if (optionId !== null) {
        return optionId;
      }
    }

    return null;
  }

  if (
    typeof value === "object" &&
    typeof value.id === "number"
  ) {
    return value.id;
  }

  return null;
}

function getItemName(value) {
  const id = getItemId(value);

  if (id === null) {
    return null;
  }

  const item = itemById.get(id);

  if (!item) {
    return null;
  }

  return item.displayName || item.name;
}

function getResultCount(result) {
  if (
    result &&
    typeof result === "object" &&
    Number.isFinite(result.count)
  ) {
    return Math.max(1, Number(result.count));
  }

  return 1;
}

function collectIngredientValues(recipe) {
  if (Array.isArray(recipe.ingredients)) {
    return recipe.ingredients;
  }

  if (Array.isArray(recipe.inShape)) {
    return recipe.inShape.flat();
  }

  return [];
}

function combineIngredients(values) {
  const quantities = new Map();

  for (const value of values) {
    const itemName = getItemName(value);

    if (!itemName) {
      continue;
    }

    quantities.set(
      itemName,
      (quantities.get(itemName) ?? 0) + 1,
    );
  }

  return Array.from(quantities.entries()).map(
    ([item, quantity]) => ({
      item,
      quantity,
    }),
  );
}

const generatedRecipes = [];
const recipesByOutput = mcData.recipes ?? {};

for (const recipeEntries of Object.values(recipesByOutput)) {
  if (!Array.isArray(recipeEntries)) {
    continue;
  }

  for (const recipe of recipeEntries) {
    if (!recipe || typeof recipe !== "object") {
      continue;
    }

    const outputItem = getItemName(recipe.result);

    if (!outputItem) {
      continue;
    }

    const ingredients = combineIngredients(
      collectIngredientValues(recipe),
    );

    if (ingredients.length === 0) {
      continue;
    }

    generatedRecipes.push({
      id: "",
      outputItem,
      outputQuantity: getResultCount(recipe.result),
      ingredients,
      createdAt: "",
      updatedAt: "",
    });
  }
}

const deduplicated = [];
const seen = new Set();

for (const recipe of generatedRecipes) {
  const signature = JSON.stringify({
    outputItem: recipe.outputItem,
    outputQuantity: recipe.outputQuantity,
    ingredients: recipe.ingredients
      .slice()
      .sort((a, b) =>
        a.item.localeCompare(b.item),
      ),
  });

  if (seen.has(signature)) {
    continue;
  }

  seen.add(signature);

  const outputSlug = recipe.outputItem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  deduplicated.push({
    ...recipe,
    id: `builtin_${outputSlug}_${deduplicated.length}`,
  });
}

deduplicated.sort((a, b) => {
  const nameComparison =
    a.outputItem.localeCompare(b.outputItem);

  if (nameComparison !== 0) {
    return nameComparison;
  }

  return a.outputQuantity - b.outputQuantity;
});

fs.mkdirSync(
  path.dirname(OUTPUT_PATH),
  {
    recursive: true,
  },
);

fs.writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      recipes: deduplicated,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(
  `Generated ${deduplicated.length} Minecraft ${VERSION} recipes.`,
);

console.log(OUTPUT_PATH);