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
    getStorageItems,
  } from "../state/storageState.ts";
  
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
  
  export function renderCraftingPage(
    container: HTMLElement,
    options: CraftingPageOptions,
  ): () => void {
    let customRecipes: CraftingRecipe[] = [];
    let builtInRecipes: CraftingRecipe[] = [];
    let builtInRecipesLoaded = false;
    let selectedSuggestion = -1;
  
    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="page-eyebrow">
            Recipe planning
          </span>
  
          <h2>Crafting</h2>
  
          <p>
            Look up Minecraft 1.19.2 recipes, calculate
            recursive ingredients, and compare them
            against your current Storage.
          </p>
        </div>
  
        <div class="page-stat">
          <strong id="recipe-count">0</strong>
          <span>custom recipes</span>
        </div>
      </section>
  
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
  
        <p
          id="crafting-error"
          class="form-error"
          hidden
        ></p>
      </section>
  
      <section
  id="crafting-results-card"
  class="content-card crafting-results-card"
  hidden
>
  <div class="crafting-results-header">
    <div>
      <span class="page-eyebrow">
        Crafting planner
      </span>

      <h3 id="crafting-results-title">
        Results
      </h3>
    </div>
  </div>

  <div
    id="crafting-tree-placeholder"
    class="crafting-tree-placeholder"
  >
    <div class="crafting-tree-placeholder-message">
      <strong>Interactive crafting tree</strong>
      <span>The graph will appear here.</span>
    </div>
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
    </section>
      <section class="results-card">
        <div class="preferences-section-header">
          <div>
            <span class="page-eyebrow">
              Recipe library
            </span>
  
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
  
    const recipeCount =
      container.querySelector<HTMLElement>(
        "#recipe-count",
      )!;

    const savedActiveState =
      loadCraftingActiveState();
    
    if (savedActiveState) {
      itemInput.value =
        savedActiveState.item;
    
      quantityInput.value =
        savedActiveState.quantityExpression;
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

        const requirements =
        calculateCraftingRequirements({
            builtInRecipes,
            customRecipes,
        
            storageItems:
              getStorageItems(),
        
            outputItem: item,
            outputQuantity: quantity,
          });
  
        resultsTitle.textContent =
          `${item} · ${formatNumber(quantity)}`;
  
        resultsContainer.innerHTML =
          requirements
            .map(
              (requirement) => `
                <article class="crafting-requirement-row">
                  <div>
                    <strong>
                      ${escapeHtml(requirement.item)}
                    </strong>
  
                    <span>
                      Required:
                      ${formatNumber(requirement.required)}
                    </span>
                  </div>
  
                  <div class="crafting-requirement-values">
                    <span>
                      Owned:
                      ${formatNumber(requirement.owned)}
                    </span>
  
                    <strong class="${
                      requirement.missing > 0
                        ? "missing"
                        : "complete"
                    }">
                      ${
                        requirement.missing > 0
                          ? `Missing ${formatNumber(requirement.missing)}`
                          : "Storage covers this"
                      }
                    </strong>
                  </div>
                </article>
              `,
            )
            .join("");
  
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
            });
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
      recipeCount.textContent =
        String(customRecipes.length);
  
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
  
    addRecipeButton.addEventListener(
      "click",
      openNewRecipe,
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
  
    const unsubscribe =
  subscribeToRecipes(
    (nextRecipes) => {
      customRecipes =
        nextRecipes;

      renderRecipes();
    },
  );

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

    return unsubscribe;
  }