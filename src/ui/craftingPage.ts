import {
  resolveItemName,
  searchItems,
  type ItemCatalog,
} from "../data/itemCatalog.ts";

import {
  addRecipe,
  deleteRecipe,
  subscribeToRecipes,
  updateRecipe,
} from "../state/recipeState.ts";

import {
  addStorageItem,
  getStorageItems,
  subscribeToStorage,
} from "../state/storageState.ts";

import {
  openStorageEditor,
} from "./storageEditor.ts";

import type {
  CraftingRecipe,
} from "../types/recipe.ts";

import {
  calculateCraftingRequirements,
} from "../utils/craftingCalculator.ts";

import {
  parseQuantityExpression,
} from "../utils/quantityParser.ts";

import {
  openRecipeEditor,
} from "./recipeEditor.ts";

import {
  getBuiltInRecipes,
} from "../data/recipeCatalog.ts";

import {
  hydrateItemIcons,
} from "../services/itemIconService.ts";

import {
  addListing,
  getListings,
  subscribeToListings,
} from "../state/appState.ts";

import {
  showContextMenu,
} from "./contextMenu.ts";

import {
  openListingEditor,
} from "./listingEditor.ts";

import type {
  ListingType,
  MarketListing,
} from "../types/listing.ts";

import {
  calculateAcquisitionPlan,
} from "../utils/profitCalculator.ts";

interface CraftingPageOptions {
  catalog: ItemCatalog;
  setStatus: (message: string) => void;
}


function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatStorageQuantity(
  value: number,
): string {
  const STACK_SIZE = 64;
  const SINGLE_CHEST_SIZE =
    STACK_SIZE * 27;
  const DOUBLE_CHEST_SIZE =
    STACK_SIZE * 54;

  function roundUnit(
    amount: number,
  ): string {
    const rounded =
      Math.round(amount * 10) / 10;

    return Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(1);
  }

  if (
    value >
    DOUBLE_CHEST_SIZE * 10
  ) {
    return ">10dc";
  }

  if (value >= DOUBLE_CHEST_SIZE) {
    return `${roundUnit(
      value / DOUBLE_CHEST_SIZE,
    )}dc`;
  }

  if (value >= SINGLE_CHEST_SIZE) {
    return `${roundUnit(
      value / SINGLE_CHEST_SIZE,
    )}sc`;
  }

  if (value >= STACK_SIZE) {
    return `${roundUnit(
      value / STACK_SIZE,
    )}s`;
  }

  return `${formatNumber(value)}x`;
}

function formatNumber(
  value: number,
): string {
  if (value > 0 && value < 0.01) {
    return "<0.01";
  }

  return value
    .toFixed(2)
    .replace(/\.?0+$/, "");
}

function formatGrass(
  value: number,
): string {
  return `${formatNumber(value)}g`;
}

const CRAFTING_USE_STORAGE_KEY =
  "grass-market-calculator.crafting-use-storage";

function loadCraftingUseStorage(): boolean {
  const saved =
    localStorage.getItem(
      CRAFTING_USE_STORAGE_KEY,
    );

  if (saved === null) {
    return false;
  }

  return saved === "true";
}

function saveCraftingUseStorage(
  enabled: boolean,
): void {
  localStorage.setItem(
    CRAFTING_USE_STORAGE_KEY,
    String(enabled),
  );
}

const CRAFTING_ACTIVE_STATE_KEY =
  "grass-market-calculator.crafting-active-state";

interface CraftingActiveState {
  item: string;
  quantityExpression: string;
}

function loadCraftingActiveState():
  CraftingActiveState | null {
  const saved =
    localStorage.getItem(
      CRAFTING_ACTIVE_STATE_KEY,
    );

  if (!saved) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(saved) as Partial<CraftingActiveState>;

    if (
      typeof parsed.item !== "string" ||
      typeof parsed.quantityExpression !== "string"
    ) {
      return null;
    }

    return {
      item: parsed.item,
      quantityExpression:
        parsed.quantityExpression,
    };
  } catch {
    return null;
  }
}

function saveCraftingActiveState(
  item: string,
  quantityExpression: string,
): void {
  localStorage.setItem(
    CRAFTING_ACTIVE_STATE_KEY,
    JSON.stringify({
      item,
      quantityExpression,
    }),
  );
}

interface CraftingDisplayNode {
  id: string;
  item: string;
  quantity: number;
  craftsNeeded: number;
  outputQuantity: number;
  depth: number;
  isRecursiveLoop: boolean;
  children: CraftingDisplayNode[];
}

interface PositionedCraftingNode {
  node: CraftingDisplayNode;
  x: number;
  y: number;
}

export function renderCraftingPage(
  container: HTMLElement,
  options: CraftingPageOptions,
): () => void {
  let customRecipes: CraftingRecipe[] = [];
  let builtInRecipes: CraftingRecipe[] = [];
  let builtInRecipesLoaded = false;
  let selectedSuggestion = -1;
  let renderedTreeWidth = 0;
  let renderedTreeHeight = 0;
  let listings: MarketListing[] =
    getListings();

  container.innerHTML = `
      <section class="page-header centered-page-header">
        <div>
          <h2>Crafting & Recipe Tree</h2>
          <p class="page-description">
            Search recipes in the local 1.19.2 recipe database, expand ingredients, and compare saved buying prices against crafting costs.
          </p>
        </div>
      </section>

      <div class="crafting-workspace">
        <div class="crafting-left-column">
  
      <section class="content-card crafting-calculator-card">
        <div class="crafting-input-grid">
          <label>
            Item to craft

            <div class="autocomplete-wrapper">
                <input
                id="crafting-item"
                type="text"
                autocomplete="off"
                placeholder="Search Minecraft items…"
                />

                <div
                id="crafting-item-suggestions"
                class="suggestions"
                hidden
                ></div>
            </div>
            </label>
  
          <label>
            Quantity wanted
  
            <input
              id="crafting-quantity"
              type="text"
              autocomplete="off"
              value="1"
            />
          </label>
        </div>
  
        <div class="quantity-action-row">
          <button
            id="calculate-crafting"
            class="primary-button"
            type="button"
          >
            Calculate ingredients
          </button>
  
          <button
            id="add-crafting-recipe"
            class="secondary-button"
            type="button"
          >
            Add custom recipe
          </button>
        </div>

        <label class="crafting-storage-option">
          <input
            id="crafting-use-storage"
            type="checkbox"
          />

          <span>
            Use items from Storage when calculating
            missing materials and crafting cost
          </span>
        </label>
  
        <p
          id="crafting-error"
          class="form-error"
          hidden
        ></p>
      </section>

      <section class="content-card crafting-recipe-library">
        <div class="preferences-section-header">
          <div>
            <h3>Custom recipe overrides</h3>
          </div>
        </div>
  
        <div
          id="recipe-list"
          class="recipe-list"
        ></div>
  
        <div
          id="recipe-empty"
          class="empty-state"
          hidden
        >
          No custom recipes have been added. 
          Minecraft 1.19.2 recipes will be used automatically.
        </div>
            </section>

        </div>
        <!-- End crafting-left-column -->

      <section
        id="crafting-results-card"
        class="content-card crafting-results-card"
        hidden
        >
  <div class="crafting-results-header">
    <div>
      <span class="page-eyebrow">
        Recipe Tree
      </span>

      <h3 id="crafting-results-title">
        Results
      </h3>
    </div>

    <div class="crafting-tree-controls">
    <button
      id="crafting-expand-all"
      class="secondary-button"
      type="button"
    >
      Expand all
    </button>

    <button
      id="crafting-collapse-all"
      class="secondary-button"
      type="button"
    >
      Collapse all
    </button>

    <button
      id="crafting-fit-tree"
      class="secondary-button"
      type="button"
    >
      Fit
    </button>
  </div>
</div>

<div
  id="crafting-tree-placeholder"
  class="crafting-tree-placeholder"
>
  <div
    id="crafting-tree-stage"
    class="crafting-tree-stage"
  >
    <svg
      id="crafting-tree-edge-layer"
      class="crafting-tree-edge-layer"
      aria-hidden="true"
    ></svg>

    <div
      id="crafting-tree-node-layer"
      class="crafting-tree-node-layer"
    ></div>
  </div>
</div>

<p class="calculator-tip crafting-tree-tip">
  <strong>Tip:</strong>
  &ensp;<b>Right click&ensp;</b>
  a recipe-tree node to add a buying listing,
  open its buying listings, or locate it in Storage.
</p>

<div
    id="crafting-name-tooltip"
    class="crafting-name-tooltip"
    hidden
></div>

<div
  id="crafting-tree-summary"
  class="crafting-tree-summary"
  hidden
>
  <div class="crafting-summary-stat">
    <span>Unique items</span>
    <strong id="crafting-summary-unique-items">
      0
    </strong>
  </div>

  <div class="crafting-summary-stat">
    <span>Total item quantity</span>
    <strong id="crafting-summary-total-items">
      0
    </strong>
  </div>

  <div class="crafting-summary-stat">
    <span>Recipe nodes</span>
    <strong id="crafting-summary-recipe-nodes">
      0
    </strong>
  </div>

  <div class="crafting-summary-stat">
    <span>Raw materials</span>
    <strong id="crafting-summary-raw-materials">
      0
    </strong>
  </div>
</div>

<div
  id="crafting-cost-comparison"
  class="crafting-cost-comparison"
  hidden
>
  <div>
    <span class="page-eyebrow">
      Craft or buy?
    </span>

    <h4 id="crafting-cost-recommendation">
      Cost comparison
    </h4>
  </div>

  <div class="crafting-cost-values">
    <div>
      <span>Crafting cost</span>

      <strong id="crafting-material-cost">
        —
      </strong>
    </div>

    <div>
      <span>Buying cost</span>

      <strong id="crafting-direct-buy-cost">
        —
      </strong>
    </div>

    <div>
      <span>Difference</span>

      <strong id="crafting-cost-difference">
        —
      </strong>
    </div>
  </div>

  <p
    id="crafting-cost-warning"
    class="crafting-cost-warning"
    hidden
  ></p>
</div>

    <div class="crafting-summary-heading">
        <span class="page-eyebrow">
        Raw-material summary
        </span>

        <h4>Final requirements</h4>
    </div>
        <div
          id="crafting-results"
          class="crafting-requirements"
        ></div>

      <p class="calculator-tip crafting-material-tip">
        <strong>Tip:</strong>
        &ensp;<b>Right click&ensp;</b>
        a raw material to add a buying listing,
        open its buying listings, or locate it in Storage.
      </p>
      </section>

      </div>
      <!-- End crafting-workspace -->
    `;

  const itemInput =
    container.querySelector<HTMLInputElement>(
      "#crafting-item",
    )!;

  const suggestionsBox =
    container.querySelector<HTMLDivElement>(
      "#crafting-item-suggestions",
    )!;

  const quantityInput =
    container.querySelector<HTMLInputElement>(
      "#crafting-quantity",
    )!;

  const calculateButton =
    container.querySelector<HTMLButtonElement>(
      "#calculate-crafting",
    )!;

  const addRecipeButton =
    container.querySelector<HTMLButtonElement>(
      "#add-crafting-recipe",
    )!;

  const errorLabel =
    container.querySelector<HTMLParagraphElement>(
      "#crafting-error",
    )!;

  const resultsCard =
    container.querySelector<HTMLElement>(
      "#crafting-results-card",
    )!;

  const resultsTitle =
    container.querySelector<HTMLElement>(
      "#crafting-results-title",
    )!;

  const fitTreeButton =
    container.querySelector<HTMLButtonElement>(
      "#crafting-fit-tree",
    )!;

  const expandAllButton =
    container.querySelector<HTMLButtonElement>(
      "#crafting-expand-all",
    )!;

  const collapseAllButton =
    container.querySelector<HTMLButtonElement>(
      "#crafting-collapse-all",
    )!;

  const nameTooltip =
    container.querySelector<HTMLElement>(
      "#crafting-name-tooltip",
    )!;

  const resultsContainer =
    container.querySelector<HTMLDivElement>(
      "#crafting-results",
    )!;

  const recipeList =
    container.querySelector<HTMLDivElement>(
      "#recipe-list",
    )!;

  const recipeEmpty =
    container.querySelector<HTMLDivElement>(
      "#recipe-empty",
    )!;

  const savedActiveState =
    loadCraftingActiveState();

  if (savedActiveState) {
    itemInput.value =
      savedActiveState.item;

    quantityInput.value =
      savedActiveState.quantityExpression;
  }

  const treeNodeLayer =
    container.querySelector<HTMLDivElement>(
      "#crafting-tree-node-layer",
    )!;

  const treeStage =
    container.querySelector<HTMLDivElement>(
      "#crafting-tree-stage",
    )!;

  const treeEdgeLayer =
    container.querySelector<SVGSVGElement>(
      "#crafting-tree-edge-layer",
    )!;

  const useStorageCheckbox =
    container.querySelector<HTMLInputElement>(
      "#crafting-use-storage",
    )!;

  useStorageCheckbox.checked =
    loadCraftingUseStorage();

  const costComparison =
    container.querySelector<HTMLDivElement>(
      "#crafting-cost-comparison",
    )!;

  const materialCostLabel =
    container.querySelector<HTMLElement>(
      "#crafting-material-cost",
    )!;

  const directBuyCostLabel =
    container.querySelector<HTMLElement>(
      "#crafting-direct-buy-cost",
    )!;

  const costDifferenceLabel =
    container.querySelector<HTMLElement>(
      "#crafting-cost-difference",
    )!;

  const costRecommendation =
    container.querySelector<HTMLElement>(
      "#crafting-cost-recommendation",
    )!;

  const costWarning =
    container.querySelector<HTMLParagraphElement>(
      "#crafting-cost-warning",
    )!;

  const treeSummary =
    container.querySelector<HTMLDivElement>(
      "#crafting-tree-summary",
    )!;

  const summaryUniqueItems =
    container.querySelector<HTMLElement>(
      "#crafting-summary-unique-items",
    )!;

  const summaryTotalItems =
    container.querySelector<HTMLElement>(
      "#crafting-summary-total-items",
    )!;

  const summaryRecipeNodes =
    container.querySelector<HTMLElement>(
      "#crafting-summary-recipe-nodes",
    )!;

  const summaryRawMaterials =
    container.querySelector<HTMLElement>(
      "#crafting-summary-raw-materials",
    )!;

  let stageX = 0;
  let stageY = 0;
  let stageScale = 1;
  let isDraggingTree = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  let currentDisplayTree:
    CraftingDisplayNode | null = null;

  const collapsedNodeIds =
    new Set<string>();

  let displayUsesStorage = false;

  let displayedStorageItems:
    ReturnType<typeof getStorageItems> = [];

  const gridParallax = 0.25;
  const minTreeScale = 0.35;
  const maxTreeScale = 2.2;

  const gridZoomStrength = 0.35;
  const baseGridSize = 28;
  let treeResizeFrame: number | null = null;

  function handleTreePointerDown(
    event: PointerEvent,
  ): void {
    if (event.button !== 0) {
      return;
    }

    const target =
      event.target as HTMLElement;

    if (
      target.closest(
        "button, input, select, textarea",
      )
    ) {
      return;
    }

    event.preventDefault();

    isDraggingTree = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    treePlaceholder.classList.add(
      "dragging",
    );

    treePlaceholder.setPointerCapture(
      event.pointerId,
    );
  }

  function handleTreePointerMove(
    event: PointerEvent,
  ): void {
    if (!isDraggingTree) {
      return;
    }

    stageX +=
      event.clientX - lastPointerX;

    stageY +=
      event.clientY - lastPointerY;

    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    updateTreeTransform();
  }

  function handleTreePointerUp(
    event: PointerEvent,
  ): void {
    if (!isDraggingTree) {
      return;
    }

    isDraggingTree = false;

    treePlaceholder.classList.remove(
      "dragging",
    );

    if (
      treePlaceholder.hasPointerCapture(
        event.pointerId,
      )
    ) {
      treePlaceholder.releasePointerCapture(
        event.pointerId,
      );
    }
  }

  const treePlaceholder =
    container.querySelector<HTMLDivElement>(
      "#crafting-tree-placeholder",
    )!;

  function updateTreeTransform(): void {
    treeStage.style.transform =
      `translate(${stageX}px, ${stageY}px) scale(${stageScale})`;

    const gridScale =
      1 +
      (stageScale - 1) *
      gridZoomStrength;

    treePlaceholder.style.backgroundPosition =
      `${stageX * gridParallax}px ` +
      `${stageY * gridParallax}px`;

    treePlaceholder.style.backgroundSize =
      `${baseGridSize * gridScale}px ` +
      `${baseGridSize * gridScale}px`;
  }

  function fitCraftingTree(): void {
    if (
      renderedTreeWidth <= 0 ||
      renderedTreeHeight <= 0
    ) {
      return;
    }

    const bounds =
      treePlaceholder.getBoundingClientRect();

    if (
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      return;
    }

    const padding = 28;

    const scaleX =
      (bounds.width - padding * 2) /
      renderedTreeWidth;

    const scaleY =
      (bounds.height - padding * 2) /
      renderedTreeHeight;

    stageScale = Math.min(
      1,
      Math.max(
        minTreeScale,
        Math.min(
          scaleX,
          scaleY,
        ),
      ),
    );

    stageX =
      (
        bounds.width -
        renderedTreeWidth *
        stageScale
      ) /
      2;

    stageY =
      (
        bounds.height -
        renderedTreeHeight *
        stageScale
      ) /
      2;

    updateTreeTransform();
  }

  const treeResizeObserver =
    new ResizeObserver(() => {
      if (
        resultsCard.hidden ||
        renderedTreeWidth <= 0 ||
        renderedTreeHeight <= 0
      ) {
        return;
      }

      if (treeResizeFrame !== null) {
        cancelAnimationFrame(
          treeResizeFrame,
        );
      }

      treeResizeFrame =
        requestAnimationFrame(() => {
          treeResizeFrame = null;
          fitCraftingTree();
        });
    });

  treeResizeObserver.observe(
    treePlaceholder,
  );

  function getListingsForItem(
    item: string,
  ): MarketListing[] {
    const normalized =
      item.trim().toLowerCase();

    return listings.filter(
      (listing) =>
        listing.item
          .trim()
          .toLowerCase() === normalized,
    );
  }

  function renderCostComparison(
    item: string,
    quantity: number,
    requirements: {
      item: string;
      required: number;
      owned: number;
      missing: number;
    }[],
    useStorage: boolean,
  ): void {
    const directPurchase =
      calculateAcquisitionPlan(
        getListingsForItem(item),
        quantity,
      );

    let materialCost = 0;
    let allMaterialsAvailable = true;

    const missingMarketItems: string[] = [];

    for (const requirement of requirements) {
      const quantityToPurchase =
        useStorage
          ? requirement.missing
          : requirement.required;

      if (quantityToPurchase <= 0) {
        continue;
      }

      const acquisition =
        calculateAcquisitionPlan(
          getListingsForItem(
            requirement.item,
          ),
          quantityToPurchase,
        );

      materialCost +=
        acquisition.totalGrass;

      if (!acquisition.complete) {
        allMaterialsAvailable = false;

        missingMarketItems.push(
          requirement.item,
        );
      }
    }

    const directBuyAvailable =
      directPurchase.complete;

    materialCostLabel.textContent =
      allMaterialsAvailable
        ? formatGrass(materialCost)
        : "Incomplete";

    directBuyCostLabel.textContent =
      directBuyAvailable
        ? formatGrass(
          directPurchase.totalGrass,
        )
        : "Unavailable";

    costComparison.hidden = false;
    costWarning.hidden = true;

    delete costComparison.dataset.recommendation;

    if (
      allMaterialsAvailable &&
      directBuyAvailable
    ) {
      const difference =
        Math.abs(
          directPurchase.totalGrass -
          materialCost,
        );

      costDifferenceLabel.textContent =
        formatGrass(difference);

      if (
        materialCost <
        directPurchase.totalGrass
      ) {
        costRecommendation.textContent =
          `Crafting is cheaper by ${formatGrass(
            difference,
          )}`;

        costComparison.dataset.recommendation =
          "craft";
      } else if (
        directPurchase.totalGrass <
        materialCost
      ) {
        costRecommendation.textContent =
          `Buying is cheaper by ${formatGrass(
            difference,
          )}`;

        costComparison.dataset.recommendation =
          "buy";
      } else {
        costRecommendation.textContent =
          "Crafting and buying cost the same";

        costComparison.dataset.recommendation =
          "equal";
      }

      return;
    }

    costDifferenceLabel.textContent = "—";

    if (
      !allMaterialsAvailable &&
      !directBuyAvailable
    ) {
      costRecommendation.textContent =
        "Not enough market data";

      costWarning.textContent =
        "Neither the finished item nor all required materials have sufficient listings.";
    } else if (!allMaterialsAvailable) {
      costRecommendation.textContent =
        "Material cost is incomplete";

      costWarning.textContent =
        `Missing sufficient listings for: ` +
        missingMarketItems.join(", ");
    } else {
      costRecommendation.textContent =
        "Finished item cannot be fully purchased";

      costWarning.textContent =
        `There are not enough listings to buy ` +
        `${formatNumber(quantity)} ${item}.`;
    }

    costWarning.hidden = false;
  }

  function openNewRecipe(): void {
    openRecipeEditor({
      catalog: options.catalog,

      onSave: (value) => {
        addRecipe(value);

        options.setStatus(
          `Added recipe for ${value.outputItem}`,
        );
      },
    });
  }
  function getSuggestions(): string[] {
    return searchItems(
      itemInput.value,
      options.catalog,
      30,
    );
  }

  function renderSuggestions(): void {
    selectedSuggestion = -1;

    if (!itemInput.value.trim()) {
      suggestionsBox.hidden = true;
      suggestionsBox.innerHTML = "";
      return;
    }

    const suggestions = getSuggestions();

    if (suggestions.length === 0) {
      suggestionsBox.hidden = true;
      suggestionsBox.innerHTML = "";
      return;
    }

    suggestionsBox.innerHTML = suggestions
      .map(
        (item, index) => `
            <button
              class="suggestion"
              type="button"
              data-index="${index}"
              data-item="${escapeHtml(item)}"
            >
              ${escapeHtml(item)}
            </button>
          `,
      )
      .join("");

    suggestionsBox.hidden = false;

    suggestionsBox
      .querySelectorAll<HTMLButtonElement>(
        ".suggestion",
      )
      .forEach((button) => {
        button.addEventListener(
          "mousedown",
          (event) => {
            event.preventDefault();

            itemInput.value =
              button.dataset.item ?? "";

            suggestionsBox.hidden = true;
            quantityInput.focus();
          },
        );
      });
  }

  function highlightSuggestion(): void {
    const buttons =
      suggestionsBox
        .querySelectorAll<HTMLButtonElement>(
          ".suggestion",
        );

    buttons.forEach((button, index) => {
      button.classList.toggle(
        "selected",
        index === selectedSuggestion,
      );
    });

    buttons[selectedSuggestion]?.scrollIntoView({
      block: "nearest",
    });
  }

  function acceptSuggestion(): boolean {
    const suggestions = getSuggestions();

    if (suggestions.length === 0) {
      return false;
    }

    const index =
      selectedSuggestion >= 0
        ? selectedSuggestion
        : 0;

    itemInput.value = suggestions[index];
    suggestionsBox.hidden = true;

    return true;
  }

  function findPreferredRecipe(
    item: string,
  ): CraftingRecipe | undefined {
    const normalized =
      item.trim().toLowerCase();

    return (
      customRecipes.find(
        (recipe) =>
          recipe.outputItem
            .trim()
            .toLowerCase() === normalized,
      ) ??
      builtInRecipes.find(
        (recipe) =>
          recipe.outputItem
            .trim()
            .toLowerCase() === normalized,
      )
    );
  }

  function buildDisplayNode(
    item: string,
    quantity: number,
    depth: number,
    path: string[],
    activeRecipePath: Set<string>,
  ): CraftingDisplayNode {
    const normalized =
      item.trim().toLowerCase();

    const nodeId = [
      ...path,
      normalized.replace(
        /[^a-z0-9]+/g,
        "-",
      ),
    ].join("/");

    if (activeRecipePath.has(normalized)) {
      return {
        id: nodeId,
        item,
        quantity,
        craftsNeeded: 0,
        outputQuantity: 0,
        depth,
        isRecursiveLoop: true,
        children: [],
      };
    }

    const recipe =
      findPreferredRecipe(item);

    if (!recipe) {
      return {
        id: nodeId,
        item,
        quantity,
        craftsNeeded: quantity,
        outputQuantity: 1,
        depth,
        isRecursiveLoop: false,
        children: [],
      };
    }

    const craftsNeeded =
      Math.ceil(
        quantity /
        recipe.outputQuantity,
      );

    const nextRecipePath =
      new Set(activeRecipePath);

    nextRecipePath.add(normalized);

    const children =
      recipe.ingredients.map(
        (ingredient, index) =>
          buildDisplayNode(
            ingredient.item,
            ingredient.quantity *
            craftsNeeded,
            depth + 1,
            [
              ...path,
              `${normalized}-${index}`,
            ],
            nextRecipePath,
          ),
      );

    return {
      id: nodeId,
      item,
      quantity,
      craftsNeeded,
      outputQuantity:
        recipe.outputQuantity,
      depth,
      isRecursiveLoop: false,
      children,
    };
  }

  function renderTreeSummary(
    root: CraftingDisplayNode,
  ): void {
    const allNodes:
      CraftingDisplayNode[] = [];

    function visit(
      node: CraftingDisplayNode,
    ): void {
      allNodes.push(node);

      for (const child of node.children) {
        visit(child);
      }
    }

    visit(root);

    const uniqueItems =
      new Set(
        allNodes.map((node) =>
          node.item.trim().toLowerCase(),
        ),
      );

    const recipeNodes =
      allNodes.filter(
        (node) =>
          node.children.length > 0 &&
          !node.isRecursiveLoop,
      );

    const rawMaterialNodes =
      allNodes.filter(
        (node) =>
          node.children.length === 0 &&
          !node.isRecursiveLoop,
      );

    const totalItemQuantity =
      allNodes.reduce(
        (total, node) =>
          total + node.quantity,
        0,
      );

    summaryUniqueItems.textContent =
      formatNumber(uniqueItems.size);

    summaryTotalItems.textContent =
      formatNumber(totalItemQuantity);

    summaryRecipeNodes.textContent =
      formatNumber(recipeNodes.length);

    summaryRawMaterials.textContent =
      formatNumber(rawMaterialNodes.length);

    treeSummary.hidden = false;
  }

  function flattenDisplayTree(
    root: CraftingDisplayNode,
  ): CraftingDisplayNode[] {
    const flattened:
      CraftingDisplayNode[] = [];

    function visit(
      node: CraftingDisplayNode,
    ): void {
      flattened.push(node);

      if (
        collapsedNodeIds.has(node.id)
      ) {
        return;
      }

      for (
        const child of node.children
      ) {
        visit(child);
      }
    }

    visit(root);

    return flattened;
  }

  function findDisplayNode(
    root: CraftingDisplayNode,
    nodeId: string,
  ): CraftingDisplayNode | null {
    if (root.id === nodeId) {
      return root;
    }

    for (const child of root.children) {
      const found =
        findDisplayNode(
          child,
          nodeId,
        );

      if (found) {
        return found;
      }
    }

    return null;
  }

  function normalizeItemName(
    value: string,
  ): string {
    return value
      .trim()
      .toLowerCase();
  }

  function hasBuyingListings(
    item: string,
  ): boolean {
    const normalized =
      normalizeItemName(item);

    return listings.some(
      (listing) =>
        listing.type === "buying" &&
        normalizeItemName(
          listing.item,
        ) === normalized,
    );
  }

  function getStoredItem(
    item: string,
  ) {
    const normalized =
      normalizeItemName(item);

    return getStorageItems().find(
      (storageItem) =>
        normalizeItemName(
          storageItem.item,
        ) === normalized,
    );
  }

  function goToBuyingListings(
    item: string,
  ): void {
    window.dispatchEvent(
      new CustomEvent(
        "gmc:navigate-listings",
        {
          detail: {
            type: "buying",
            item,
          },
        },
      ),
    );
  }

  function goToStorageItem(
    item: string,
  ): void {
    window.dispatchEvent(
      new CustomEvent(
        "gmc:navigate-storage",
        {
          detail: {
            item,
          },
        },
      ),
    );
  }

  function openCraftingItemContextMenu(
    item: string,
    x: number,
    y: number,
  ): void {
    const buyingListingsAvailable =
      hasBuyingListings(item);

    const storedItem =
      getStoredItem(item);

    showContextMenu(
      x,
      y,
      [
        {
          icon: "↓",
          label: "Add buying listing",

          action: () => {
            openRequirementListing(
              item,
            );
          },
        },

        {
          icon: "⌕",
          label: "Go to item listings",
          disabled:
            !buyingListingsAvailable,

          action: () => {
            goToBuyingListings(
              item,
            );
          },
        },

        {
          separator: true,
        },

        storedItem
          ? {
            icon: "▣",
            label: "Go to item in Storage",

            action: () => {
              goToStorageItem(
                item,
              );
            },
          }
          : {
            icon: "+",
            label: "Add item to Storage",

            action: () => {
              openNewStorageItem(
                item,
              );
            },
          },
      ],
    );
  }

  function openNewStorageItem(
    item: string,
  ): void {
    openStorageEditor({
      catalog: options.catalog,
      initialItem: item,

      onSave: (value) => {
        addStorageItem(value);

        options.setStatus(
          `Added ${value.item} to Storage`,
        );
      },
    });
  }

  function openRequirementListing(
    item: string,
  ): void {
    openListingEditor({
      catalog: options.catalog,
      type: "buying",
      initialItem: item,

      onSave: (listing) => {
        addListing(listing);

        options.setStatus(
          `Added buying listing for ${listing.item}`,
        );
      },
    });
  }

  function openNodeListing(
    node: CraftingDisplayNode,
    type: ListingType,
  ): void {
    openListingEditor({
      catalog: options.catalog,
      type,
      initialItem: node.item,

      onSave: (listing) => {
        addListing(listing);

        options.setStatus(
          `Added ${type} listing for ${listing.item}`,
        );
      },
    });
  }

  function getOwnedQuantity(
    item: string,
  ): number {
    if (!displayUsesStorage) {
      return 0;
    }

    const normalized =
      item.trim().toLowerCase();

    return displayedStorageItems
      .filter(
        (entry) =>
          entry.item
            .trim()
            .toLowerCase() === normalized,
      )
      .reduce(
        (total, entry) =>
          total + entry.quantity,
        0,
      );
  }

  function getRequirementMarketPrice(
    item: string,
    quantity: number,
  ): {
    totalCost: number;
    unitCost: number;
  } | null {
    if (quantity <= 0) {
      return null;
    }

    const acquisition =
      calculateAcquisitionPlan(
        getListingsForItem(item),
        quantity,
      );

    if (!acquisition.complete) {
      return null;
    }

    return {
      totalCost:
        acquisition.totalGrass,

      unitCost:
        acquisition.totalGrass /
        quantity,
    };
  }

  function getNodeUnitCost(
    item: string,
    requiredQuantity: number,
  ): string | null {
    if (requiredQuantity <= 0) {
      return null;
    }

    const acquisition =
      calculateAcquisitionPlan(
        getListingsForItem(item),
        requiredQuantity,
      );

    if (!acquisition.complete) {
      return null;
    }

    const unitCost =
      acquisition.totalGrass /
      requiredQuantity;

    return `${formatGrass(unitCost)} each`;
  }

  function renderCraftingTree(
    root: CraftingDisplayNode,
  ): void {
    currentDisplayTree = root;
    stageX = 0;
    stageY = 0;
    stageScale = 1;

    const nodes =
      flattenDisplayTree(root);

    const levels =
      new Map<number, CraftingDisplayNode[]>();

    for (const node of nodes) {
      const level =
        levels.get(node.depth) ?? [];

      level.push(node);
      levels.set(node.depth, level);
    }

    const nodeWidth = 200;
    const nodeHeight = 104;
    const recursiveNodeHeight = 136;
    const verticalGap = 56;
    const canvasPadding = 20;

    function getLayoutNodeHeight(
      node: CraftingDisplayNode,
    ): number {
      return node.isRecursiveLoop
        ? recursiveNodeHeight
        : nodeHeight;
    }

    const largestBranchCount =
      Math.max(
        1,
        ...nodes.map(
          (node) =>
            collapsedNodeIds.has(node.id)
              ? 0
              : node.children.length,
        ),
      );

    const horizontalGap =
      Math.min(
        190,
        70 +
        Math.max(
          0,
          largestBranchCount - 1) * 22,
      );

    const maxDepth =
      Math.max(
        ...nodes.map(
          (node) => node.depth,
        ),
      );

    renderedTreeWidth =
      canvasPadding * 2 +
      nodeWidth +
      maxDepth *
      (
        nodeWidth +
        horizontalGap
      );

    const tallestLevelHeight =
      Math.max(
        ...Array.from(
          levels.values(),
        ).map((level) =>
          level.reduce(
            (total, levelNode) =>
              total +
              getLayoutNodeHeight(
                levelNode,
              ),
            0,
          ) +
          Math.max(
            0,
            level.length - 1,
          ) *
          verticalGap
        ),
      );

    renderedTreeHeight =
      canvasPadding * 2 +
      tallestLevelHeight;

    treeStage.style.width =
      `${renderedTreeWidth}px`;

    treeStage.style.height =
      `${renderedTreeHeight}px`;

    treeNodeLayer.style.width =
      `${renderedTreeWidth}px`;

    treeNodeLayer.style.height =
      `${renderedTreeHeight}px`;

    treeEdgeLayer.setAttribute(
      "width",
      String(renderedTreeWidth),
    );

    treeEdgeLayer.setAttribute(
      "height",
      String(renderedTreeHeight),
    );

    treeEdgeLayer.setAttribute(
      "viewBox",
      `0 0 ${renderedTreeWidth} ${renderedTreeHeight}`,
    );

    const positionedNodes:
      PositionedCraftingNode[] = [];

    for (const node of nodes) {
      const level =
        levels.get(node.depth) ?? [];

      const rowIndex =
        level.indexOf(node);

      const levelHeight =
        level.reduce(
          (total, levelNode) =>
            total +
            getLayoutNodeHeight(levelNode),
          0,
        ) +
        Math.max(
          0,
          level.length - 1,
        ) *
        verticalGap;

      const x =
        canvasPadding +
        node.depth *
        (
          nodeWidth +
          horizontalGap
        );

      const previousNodesHeight =
        level
          .slice(0, rowIndex)
          .reduce(
            (total, levelNode) =>
              total +
              getLayoutNodeHeight(levelNode),
            0,
          );

      const y =
        canvasPadding +
        (
          renderedTreeHeight -
          canvasPadding * 2 -
          levelHeight
        ) /
        2 +
        previousNodesHeight +
        rowIndex *
        verticalGap;

      positionedNodes.push({
        node,
        x,
        y,
      });
    }

    treeNodeLayer.innerHTML =
      positionedNodes
        .map(({ node, x, y }) => {
          const isCollapsed =
            collapsedNodeIds.has(node.id);

          const canCollapse =
            node.children.length > 0;

          const ownedQuantity =
            getOwnedQuantity(node.item);

          const storageStatusClass =
            !displayUsesStorage
              ? ""
              : ownedQuantity <= 0
                ? "storage-none"
                : ownedQuantity < node.quantity
                  ? "storage-partial"
                  : "storage-covered";

          const unitCost =
            getNodeUnitCost(
              node.item,
              node.quantity,
            );

          return `
                <article
                  class="
                    crafting-dynamic-node
                    ${node.isRecursiveLoop
              ? "recursive-loop"
              : ""
            }
                    ${isCollapsed
              ? "collapsed"
              : ""
            }
                    ${storageStatusClass}
                  "
                  data-node-id="${escapeHtml(node.id)}"
                  style="
                    left: ${x}px;
                    top: ${y}px;
                  "
                >
                  ${canCollapse
              ? `
                        <button
                          class="crafting-node-toggle"
                          type="button"
                          data-node-id="${escapeHtml(node.id)}"
                          aria-expanded="${!isCollapsed}"
                          title="${isCollapsed
                ? "Expand ingredients"
                : "Collapse ingredients"
              }"
                        >
                          ${isCollapsed ? "▶" : "◀"}
                        </button>
                      `
              : ""
            }
              
                  <div class="crafting-node-icon-column">
                    <div
                      class="item-icon crafting-dynamic-node-icon"
                      data-item="${escapeHtml(node.item)}"
                      aria-hidden="true"
                    >
                      ?
                    </div>

                    <strong class="crafting-node-icon-quantity">
                      ${formatNumber(node.quantity)}x
                    </strong>
                  </div>

                  <div class="crafting-dynamic-node-copy">
                  <strong
                    class="crafting-node-name"
                    data-full-name="${escapeHtml(node.item)}"
                  >
                    ${escapeHtml(node.item)}
                  </strong>

                  ${displayUsesStorage
              ? `
                          <span
                            class="crafting-node-owned ${ownedQuantity > 0
                ? "has-items"
                : "missing-items"
              }"
                            title="Has ${formatNumber(
                ownedQuantity,
              )} items"
                          >
                            Has ${formatStorageQuantity(
                ownedQuantity,
              )}
                          </span>
                        `
              : ""
            }

                  ${unitCost
              ? `
                          <span class="crafting-node-price">
                            ${unitCost}
                          </span>
                        `
              : `
                          <span class="crafting-node-price missing">
                            No market price
                          </span>
                  
                          <button
                            class="crafting-node-add-buying"
                            type="button"
                            data-node-id="${escapeHtml(node.id)}"
                          >
                            Add listing
                          </button>
                        `
            }

                  ${node.isRecursiveLoop
              ? `
                        <span class="crafting-node-loop-note">
                          Recursive Item.
                        </span>
                      `
              : ""
            }
                </div>
              </article>
            `;
        })
        .join("");

    const positionedById =
      new Map(
        positionedNodes.map(
          (entry) => [
            entry.node.id,
            entry,
          ],
        ),
      );

    const edgePaths: string[] = [];

    function addEdges(
      parent: CraftingDisplayNode,
    ): void {
      if (
        collapsedNodeIds.has(parent.id)
      ) {
        return;
      }

      const positionedParent =
        positionedById.get(parent.id);

      if (!positionedParent) {
        return;
      }

      for (const child of parent.children) {
        const positionedChild =
          positionedById.get(child.id);

        if (!positionedChild) {
          continue;
        }

        const startX =
          positionedParent.x +
          nodeWidth;

        const startY =
          positionedParent.y +
          getLayoutNodeHeight(
            parent,
          ) /
          2;

        const endX =
          positionedChild.x;

        const endY =
          positionedChild.y +
          getLayoutNodeHeight(
            child,
          ) /
          2;

        const controlDistance =
          Math.max(
            24,
            (endX - startX) * 0.42,
          );

        edgePaths.push(`
            <path
              class="
                crafting-tree-edge
                ${child.isRecursiveLoop
            ? "recursive-loop"
            : ""
          }
              "
              d="
                M ${startX} ${startY}
                C
                  ${startX + controlDistance} ${startY},
                  ${endX - controlDistance} ${endY},
                  ${endX} ${endY}
              "
            ></path>
          `);

        addEdges(child);
      }
    }

    addEdges(root);

    treeEdgeLayer.innerHTML =
      edgePaths.join("");

    hydrateItemIcons(treeNodeLayer);

    void hydrateItemIcons(
      treeNodeLayer,
    );

    requestAnimationFrame(() => {
      fitCraftingTree();
    });
  }

  function showNameTooltip(
    target: HTMLElement,
  ): void {
    if (
      target.scrollWidth <=
      target.clientWidth
    ) {
      return;
    }

    nameTooltip.textContent =
      target.dataset.fullName ?? "";

    const rect =
      target.getBoundingClientRect();

    nameTooltip.hidden = false;
    nameTooltip.classList.add(
      "visible",
    );

    requestAnimationFrame(() => {
      nameTooltip.style.left =
        `${rect.left +
        rect.width / 2 -
        nameTooltip.offsetWidth / 2
        }px`;

      nameTooltip.style.top =
        `${rect.top -
        nameTooltip.offsetHeight -
        8
        }px`;
    });
  }

  function hideNameTooltip(): void {
    nameTooltip.hidden = true;
    nameTooltip.classList.remove(
      "visible",
    );
  }

  function handleTreeNodeClick(
    event: MouseEvent,
  ): void {
    const target =
      event.target as HTMLElement;

    const addBuyingButton =
      target.closest<HTMLButtonElement>(
        ".crafting-node-add-buying",
      );

    if (
      addBuyingButton &&
      currentDisplayTree
    ) {
      const nodeId =
        addBuyingButton.dataset.nodeId;

      if (!nodeId) {
        return;
      }

      const node =
        findDisplayNode(
          currentDisplayTree,
          nodeId,
        );

      if (!node) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      openNodeListing(
        node,
        "buying",
      );

      return;
    }

    const toggleButton =
      target.closest<HTMLButtonElement>(
        ".crafting-node-toggle",
      );

    if (
      !toggleButton ||
      !currentDisplayTree
    ) {
      return;
    }

    const nodeId =
      toggleButton.dataset.nodeId;

    if (!nodeId) {
      return;
    }

    if (
      collapsedNodeIds.has(nodeId)
    ) {
      collapsedNodeIds.delete(nodeId);
    } else {
      collapsedNodeIds.add(nodeId);
    }

    renderCraftingTree(
      currentDisplayTree,
    );
  }

  function handleTreeNodeContextMenu(
    event: MouseEvent,
  ): void {
    const target =
      event.target as HTMLElement;

    const nodeElement =
      target.closest<HTMLElement>(
        ".crafting-dynamic-node",
      );

    if (
      !nodeElement ||
      !currentDisplayTree
    ) {
      return;
    }

    const nodeId =
      nodeElement.dataset.nodeId;

    if (!nodeId) {
      return;
    }

    const node =
      findDisplayNode(
        currentDisplayTree,
        nodeId,
      );

    if (!node) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    openCraftingItemContextMenu(
      node.item,
      event.clientX,
      event.clientY,
    );
  }

  function handleRequirementContextMenu(
    event: MouseEvent,
  ): void {
    const target =
      event.target as HTMLElement;

    const row =
      target.closest<HTMLElement>(
        ".crafting-requirement-row",
      );

    if (!row) {
      return;
    }

    const item =
      row.dataset.item;

    if (!item) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    openCraftingItemContextMenu(
      item,
      event.clientX,
      event.clientY,
    );
  }

  function expandAllNodes(): void {
    if (!currentDisplayTree) {
      return;
    }

    collapsedNodeIds.clear();

    renderCraftingTree(
      currentDisplayTree,
    );
  }

  function collapseAllNodes(): void {
    if (!currentDisplayTree) {
      return;
    }

    collapsedNodeIds.clear();

    function collapseNode(
      node: CraftingDisplayNode,
    ): void {
      if (node.children.length > 0) {
        collapsedNodeIds.add(node.id);
      }

      for (const child of node.children) {
        collapseNode(child);
      }
    }

    collapseNode(currentDisplayTree);

    renderCraftingTree(
      currentDisplayTree,
    );
  }

  function calculate(): void {
    errorLabel.hidden = true;

    const item =
      resolveItemName(
        itemInput.value,
        options.catalog,
      );

    if (!item) {
      const suggestion =
        searchItems(
          itemInput.value,
          options.catalog,
          1,
        )[0];

      errorLabel.textContent =
        suggestion
          ? `Did you mean “${suggestion}”?`
          : "Choose a valid Minecraft item.";

      errorLabel.hidden = false;
      resultsCard.hidden = true;
      return;
    }

    let quantity: number;

    try {
      quantity =
        parseQuantityExpression(
          quantityInput.value,
        );
    } catch (error) {
      errorLabel.textContent =
        error instanceof Error
          ? error.message
          : "Invalid quantity.";

      errorLabel.hidden = false;
      resultsCard.hidden = true;
      return;
    }

    try {
      if (!builtInRecipesLoaded) {
        errorLabel.textContent =
          "Minecraft recipe data is still loading.";

        errorLabel.hidden = false;
        resultsCard.hidden = true;
        return;
      }

      saveCraftingActiveState(
        item,
        quantityInput.value,
      );

      resultsCard.hidden = false;

      const useStorage =
        useStorageCheckbox.checked;

      const storageItems =
        useStorage
          ? getStorageItems()
          : [];

      displayUsesStorage =
        useStorage;

      displayedStorageItems =
        storageItems;

      const requirements =
        calculateCraftingRequirements({
          builtInRecipes,
          customRecipes,
          storageItems,
          outputItem: item,
          outputQuantity: quantity,
        });

      renderCostComparison(
        item,
        quantity,
        requirements,
        useStorage,
      );

      resultsTitle.textContent =
        `${item} · ${formatNumber(quantity)}`;

      collapsedNodeIds.clear();

      const displayTree =
        buildDisplayNode(
          item,
          quantity,
          0,
          ["root"],
          new Set<string>(),
        );

      renderCraftingTree(
        displayTree,
      );

      renderTreeSummary(
        displayTree,
      );

      resultsContainer.innerHTML =
        requirements
          .map((requirement) => {
            const storedItem =
              getStoredItem(
                requirement.item,
              );

            if (useStorage) {
              return `
          <article
            class="crafting-requirement-row"
            data-item="${escapeHtml(
                requirement.item,
              )}"
          >
            <div>
              <strong>
                ${escapeHtml(
                requirement.item,
              )}
              </strong>

              <span>
                Required:
                ${formatNumber(
                requirement.required,
              )}
              </span>
            </div>

            <div class="crafting-requirement-values">
              <span>
                Owned:
                ${formatNumber(
                requirement.owned,
              )}
              </span>

              <strong
                class="${requirement.missing > 0
                  ? "missing"
                  : "complete"
                }"
              >
                ${requirement.missing > 0
                  ? `Missing ${formatNumber(
                    requirement.missing,
                  )}`
                  : "Storage covers this"
                }
              </strong>

              ${!storedItem
                  ? `
                    <button
                      class="crafting-requirement-add-storage"
                      type="button"
                      data-item="${escapeHtml(
                    requirement.item,
                  )}"
                    >
                      Add to Storage
                    </button>
                  `
                  : ""
                }
            </div>
          </article>
        `;
            }

            const marketPrice =
              getRequirementMarketPrice(
                requirement.item,
                requirement.required,
              );

            return `
        <article
          class="crafting-requirement-row"
          data-item="${escapeHtml(
              requirement.item,
            )}"
        >
          <div>
            <strong>
              ${escapeHtml(
              requirement.item,
            )}
            </strong>

            <span>
              Required:
              ${formatNumber(
              requirement.required,
            )}
            </span>
          </div>

          ${marketPrice
                ? `
                  <div class="crafting-requirement-values">
                    <span>
                      Market price:
                      ${formatGrass(
                  marketPrice.unitCost,
                )}
                      each
                    </span>

                    <strong class="complete">
                      ${formatGrass(
                  marketPrice.totalCost,
                )}
                      total
                    </strong>
                  </div>
                `
                : `
                  <div
                    class="crafting-requirement-market-missing"
                  >
                    <strong>
                      No market price found
                    </strong>

                    <button
                      class="crafting-requirement-add-listing"
                      type="button"
                      data-item="${escapeHtml(requirement.item,)}"
                    >
                      Add listing
                    </button>
                    ${!storedItem
                  ? `
                          <button
                            class="crafting-requirement-add-storage"
                            type="button"
                            data-item="${escapeHtml(
                    requirement.item,
                  )}"
                          >
                            Add to Storage
                          </button>
                        `
                  : ""
                }
                  </div>
                `
              }
        </article>
      `;
          })
          .join("");

      resultsContainer
        .querySelectorAll<HTMLButtonElement>(
          ".crafting-requirement-add-listing",
        )
        .forEach((button) => {
          button.addEventListener(
            "click",
            () => {
              const item =
                button.dataset.item;

              if (!item) {
                return;
              }

              openRequirementListing(item);
            },
          );
        });

      resultsContainer
        .querySelectorAll<HTMLButtonElement>(
          ".crafting-requirement-add-storage",
        )
        .forEach((button) => {
          button.addEventListener(
            "click",
            () => {
              const item =
                button.dataset.item;

              if (!item) {
                return;
              }

              openNewStorageItem(item);
            },
          );
        });

      options.setStatus(
        `Calculated ingredients for ${item}`,
      );
    } catch (error) {
      errorLabel.textContent =
        error instanceof Error
          ? error.message
          : "The recipe could not be calculated.";

      errorLabel.hidden = false;
      resultsCard.hidden = true;
    }
  }

  function renderRecipes(): void {
    recipeList.innerHTML =
      customRecipes
        .sort((a, b) =>
          a.outputItem.localeCompare(
            b.outputItem,
          ),
        )
        .map(
          (recipe) => `
              <article
                class="recipe-card"
                data-id="${escapeHtml(recipe.id)}"
              >
                <div>
                  <strong>
                    ${escapeHtml(recipe.outputItem)}
                    ×${formatNumber(recipe.outputQuantity)}
                  </strong>
  
                  <span>
                    ${recipe.ingredients
              .map(
                (ingredient) =>
                  `${escapeHtml(
                    ingredient.item,
                  )} ×${formatNumber(
                    ingredient.quantity,
                  )}`,
              )
              .join(" · ")}
                  </span>
                </div>
  
                <div class="recipe-card-actions">
                  <button
                    class="secondary-button"
                    type="button"
                    data-action="edit"
                  >
                    Edit
                  </button>
  
                  <button
                    class="storage-remove-button"
                    type="button"
                    data-action="delete"
                    title="Delete recipe"
                  >
                    ×
                  </button>
                </div>
              </article>
            `,
        )
        .join("");

    recipeList.hidden =
      customRecipes.length === 0;

    recipeEmpty.hidden =
      customRecipes.length !== 0;

    recipeList
      .querySelectorAll<HTMLButtonElement>(
        "button[data-action]",
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            const card =
              button.closest<HTMLElement>(
                "[data-id]",
              );

            const recipe =
              customRecipes.find(
                (entry) =>
                  entry.id ===
                  card?.dataset.id,
              );

            if (!recipe) {
              return;
            }

            if (
              button.dataset.action ===
              "edit"
            ) {
              openRecipeEditor({
                catalog:
                  options.catalog,
                existing: recipe,

                onSave: (value) => {
                  updateRecipe({
                    ...recipe,
                    ...value,
                  });

                  options.setStatus(
                    `Updated recipe for ${value.outputItem}`,
                  );
                },
              });

              return;
            }

            if (
              button.dataset.action ===
              "delete"
            ) {
              const confirmed =
                window.confirm(
                  `Delete the recipe for ${recipe.outputItem}?`,
                );

              if (!confirmed) {
                return;
              }

              deleteRecipe(recipe.id);

              options.setStatus(
                `Deleted recipe for ${recipe.outputItem}`,
              );
            }
          },
        );
      });
  }

  calculateButton.addEventListener(
    "click",
    calculate,
  );

  itemInput.addEventListener(
    "input",
    renderSuggestions,
  );

  itemInput.addEventListener(
    "keydown",
    (event) => {
      const suggestions = getSuggestions();

      if (
        event.key === "ArrowDown" &&
        !suggestionsBox.hidden
      ) {
        event.preventDefault();

        selectedSuggestion = Math.min(
          selectedSuggestion + 1,
          suggestions.length - 1,
        );

        highlightSuggestion();
        return;
      }

      if (
        event.key === "ArrowUp" &&
        !suggestionsBox.hidden
      ) {
        event.preventDefault();

        selectedSuggestion = Math.max(
          selectedSuggestion - 1,
          0,
        );

        highlightSuggestion();
        return;
      }

      if (
        event.key === "Tab" &&
        suggestions.length > 0
      ) {
        event.preventDefault();

        acceptSuggestion();
        quantityInput.focus();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        if (
          !suggestionsBox.hidden &&
          suggestions.length > 0
        ) {
          acceptSuggestion();
          quantityInput.focus();
        } else {
          calculate();
        }

        return;
      }

      if (event.key === "Escape") {
        suggestionsBox.hidden = true;
      }
    },
  );

  itemInput.addEventListener(
    "blur",
    () => {
      window.setTimeout(() => {
        suggestionsBox.hidden = true;
      }, 100);
    },
  );

  quantityInput.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        calculate();
      }
    },
  );

  treePlaceholder.addEventListener(
    "pointerdown",
    handleTreePointerDown,
  );

  treePlaceholder.addEventListener(
    "pointermove",
    handleTreePointerMove,
  );

  treePlaceholder.addEventListener(
    "pointerup",
    handleTreePointerUp,
  );

  treePlaceholder.addEventListener(
    "pointercancel",
    handleTreePointerUp,
  );

  treeNodeLayer.addEventListener(
    "mouseover",
    (event) => {
      const name =
        (event.target as HTMLElement)
          .closest<HTMLElement>(
            ".crafting-node-name",
          );

      if (name) {
        showNameTooltip(name);
      }
    },
  );

  treeNodeLayer.addEventListener(
    "mouseout",
    (event) => {
      if (
        (event.target as HTMLElement)
          .closest(".crafting-node-name")
      ) {
        hideNameTooltip();
      }
    },
  );

  function handleTreeWheel(
    event: WheelEvent,
  ): void {
    event.preventDefault();

    const bounds =
      treePlaceholder.getBoundingClientRect();

    const pointerX =
      event.clientX -
      bounds.left;

    const pointerY =
      event.clientY -
      bounds.top;

    const previousScale =
      stageScale;

    const zoomFactor =
      event.deltaY < 0
        ? 1.12
        : 1 / 1.12;

    stageScale = Math.min(
      maxTreeScale,
      Math.max(
        minTreeScale,
        stageScale * zoomFactor,
      ),
    );

    if (stageScale === previousScale) {
      return;
    }

    const worldX =
      (
        pointerX -
        stageX
      ) /
      previousScale;

    const worldY =
      (
        pointerY -
        stageY
      ) /
      previousScale;

    stageX =
      pointerX -
      worldX *
      stageScale;

    stageY =
      pointerY -
      worldY *
      stageScale;

    updateTreeTransform();
  }

  treePlaceholder.addEventListener(
    "wheel",
    handleTreeWheel,
    {
      passive: false,
    },
  );

  addRecipeButton.addEventListener(
    "click",
    openNewRecipe,
  );

  expandAllButton.addEventListener(
    "click",
    expandAllNodes,
  );

  collapseAllButton.addEventListener(
    "click",
    collapseAllNodes,
  );

  fitTreeButton.addEventListener(
    "click",
    fitCraftingTree,
  );

  function handleUseStorageChange(): void {
    saveCraftingUseStorage(
      useStorageCheckbox.checked,
    );

    calculate();
  }

  useStorageCheckbox.addEventListener(
    "change",
    handleUseStorageChange,
  );

  treeNodeLayer.addEventListener(
    "click",
    handleTreeNodeClick,
  );

  treeNodeLayer.addEventListener(
    "contextmenu",
    handleTreeNodeContextMenu,
  );

  resultsContainer.addEventListener(
    "contextmenu",
    handleRequirementContextMenu,
  );

  const unsubscribe =
    subscribeToRecipes(
      (nextRecipes) => {
        customRecipes =
          nextRecipes;

        renderRecipes();
      },
    );

  const unsubscribeListings =
    subscribeToListings(
      (nextListings) => {
        listings = nextListings;

        if (
          itemInput.value.trim() &&
          quantityInput.value.trim()
        ) {
          calculate();
        }
      },
    );

  const unsubscribeStorage =
    subscribeToStorage(() => {
      if (
        itemInput.value.trim() &&
        quantityInput.value.trim()
      ) {
        calculate();
      }
    });

  void getBuiltInRecipes()
    .then((loadedRecipes) => {
      builtInRecipes =
        loadedRecipes;
      builtInRecipesLoaded = true;

      if (
        itemInput.value.trim() &&
        quantityInput.value.trim()
      ) {
        calculate();
      }

      options.setStatus(
        `Loaded ${loadedRecipes.length} Minecraft 1.19.2 recipes`,
      );
    })
    .catch((error) => {
      console.error(
        "Could not load built-in recipes.",
        error,
      );

      builtInRecipes = [];
      builtInRecipesLoaded = true;

      options.setStatus(
        "Minecraft recipe data could not be loaded",
      );
    });

  return () => {
    unsubscribe();
    unsubscribeListings();
    unsubscribeStorage();

    resultsContainer.removeEventListener(
      "contextmenu",
      handleRequirementContextMenu,
    );

    treeNodeLayer.removeEventListener(
      "click",
      handleTreeNodeClick,
    );

    treeResizeObserver.disconnect();

    if (treeResizeFrame !== null) {
      cancelAnimationFrame(
        treeResizeFrame,
      );
    }

    useStorageCheckbox.removeEventListener(
      "change",
      handleUseStorageChange,
    );

    expandAllButton.removeEventListener(
      "click",
      expandAllNodes,
    );

    collapseAllButton.removeEventListener(
      "click",
      collapseAllNodes,
    );

    fitTreeButton.removeEventListener(
      "click",
      fitCraftingTree,
    );

    treePlaceholder.removeEventListener(
      "pointerdown",
      handleTreePointerDown,
    );

    treePlaceholder.removeEventListener(
      "pointermove",
      handleTreePointerMove,
    );

    treePlaceholder.removeEventListener(
      "pointerup",
      handleTreePointerUp,
    );

    treePlaceholder.removeEventListener(
      "pointercancel",
      handleTreePointerUp,
    );

    treePlaceholder.removeEventListener(
      "wheel",
      handleTreeWheel,
    );
  };
}