import {
    resolveItemName,
    searchItems,
    type ItemCatalog,
  } from "../data/itemCatalog.ts";
  
  import type {
    CraftingRecipe,
    RecipeIngredient,
  } from "../types/recipe.ts";
  
  import {
    parseQuantityExpression,
  } from "../utils/quantityParser.ts";
  
  
  interface RecipeEditorOptions {
    catalog: ItemCatalog;
    existing?: CraftingRecipe;
  
    onSave: (value: {
      outputItem: string;
      outputQuantity: number;
      ingredients: RecipeIngredient[];
    }) => void;
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
  
  
  export function openRecipeEditor(
    options: RecipeEditorOptions,
  ): void {
    const existing =
      options.existing;
  
    const backdrop =
      document.createElement("div");
  
    backdrop.className =
      "dialog-backdrop";
  
    const dialog =
      document.createElement("section");
  
    dialog.className =
      "dialog recipe-editor-dialog";
  
    dialog.innerHTML = `
      <header class="dialog-header">
        <div>
          <span class="page-eyebrow">
            Custom recipe
          </span>
  
          <h2>
            ${
              existing
                ? "Edit recipe"
                : "Add recipe"
            }
          </h2>
        </div>
  
        <button
          class="dialog-close-button"
          type="button"
          aria-label="Close"
        >
          ×
        </button>
      </header>
  
      <div class="dialog-body">
        <div class="recipe-output-grid">
          <label>
            Output item
  
            <input
              id="recipe-output-item"
              type="text"
              autocomplete="off"
              value="${escapeHtml(
                existing?.outputItem ?? "",
              )}"
              placeholder="Example: Chest"
            />
          </label>
  
          <label>
            Output quantity
  
            <input
              id="recipe-output-quantity"
              type="text"
              autocomplete="off"
              value="${escapeHtml(
                String(
                  existing?.outputQuantity ??
                    1,
                ),
              )}"
            />
          </label>
        </div>
  
        <div class="recipe-editor-heading">
          <div>
            <strong>Ingredients</strong>
  
            <span>
              Enter the quantity required
              for one recipe craft.
            </span>
          </div>
  
          <button
            id="add-recipe-ingredient"
            class="secondary-button"
            type="button"
          >
            Add ingredient
          </button>
        </div>
  
        <div
          id="recipe-ingredient-list"
          class="recipe-ingredient-list"
        ></div>
  
        <p
          id="recipe-editor-error"
          class="form-error"
          hidden
        ></p>
      </div>
  
      <footer class="dialog-footer">
        <button
          id="cancel-recipe"
          class="secondary-button"
          type="button"
        >
          Cancel
        </button>
  
        <button
          id="save-recipe"
          class="primary-button"
          type="button"
        >
          ${
            existing
              ? "Save changes"
              : "Add recipe"
          }
        </button>
      </footer>
    `;
  
    backdrop.append(dialog);
    document.body.append(backdrop);
  
    const outputItemInput =
      dialog.querySelector<HTMLInputElement>(
        "#recipe-output-item",
      )!;
  
    const outputQuantityInput =
      dialog.querySelector<HTMLInputElement>(
        "#recipe-output-quantity",
      )!;
  
    const ingredientList =
      dialog.querySelector<HTMLDivElement>(
        "#recipe-ingredient-list",
      )!;
  
    const errorLabel =
      dialog.querySelector<HTMLParagraphElement>(
        "#recipe-editor-error",
      )!;
  
    let ingredientRows:
      RecipeIngredient[] =
        existing?.ingredients.map(
          (ingredient) => ({
            ...ingredient,
          }),
        ) ?? [
          {
            item: "",
            quantity: 1,
          },
        ];
  
  
    function close(): void {
      backdrop.remove();
    }
  
  
    function renderIngredients(): void {
      ingredientList.innerHTML =
        ingredientRows
          .map(
            (ingredient, index) => `
              <div
                class="recipe-ingredient-row"
                data-index="${index}"
              >
                <input
                  type="text"
                  data-field="item"
                  autocomplete="off"
                  value="${escapeHtml(
                    ingredient.item,
                  )}"
                  placeholder="Ingredient item"
                />
  
                <input
                  type="text"
                  data-field="quantity"
                  autocomplete="off"
                  value="${escapeHtml(
                    String(
                      ingredient.quantity,
                    ),
                  )}"
                  placeholder="Quantity"
                />
  
                <button
                  class="storage-remove-button"
                  type="button"
                  data-action="remove"
                  aria-label="Remove ingredient"
                  title="Remove ingredient"
                >
                  ×
                </button>
              </div>
            `,
          )
          .join("");
  
      ingredientList
        .querySelectorAll<HTMLInputElement>(
          "input",
        )
        .forEach((input) => {
          input.addEventListener(
            "input",
            () => {
              const row =
                input.closest<HTMLElement>(
                  "[data-index]",
                );
  
              const index =
                Number(row?.dataset.index);
  
              if (
                !Number.isInteger(index) ||
                !ingredientRows[index]
              ) {
                return;
              }
  
              if (
                input.dataset.field ===
                "item"
              ) {
                ingredientRows[index].item =
                  input.value;
              }
            },
          );
  
          input.addEventListener(
            "blur",
            () => {
              if (
                input.dataset.field !==
                "item"
              ) {
                return;
              }
  
              const canonical =
                resolveItemName(
                  input.value,
                  options.catalog,
                );
  
              if (canonical) {
                input.value = canonical;
  
                const row =
                  input.closest<HTMLElement>(
                    "[data-index]",
                  );
  
                const index =
                  Number(
                    row?.dataset.index,
                  );
  
                if (
                  ingredientRows[index]
                ) {
                  ingredientRows[index].item =
                    canonical;
                }
              }
            },
          );
        });
  
      ingredientList
        .querySelectorAll<HTMLButtonElement>(
          '[data-action="remove"]',
        )
        .forEach((button) => {
          button.addEventListener(
            "click",
            () => {
              const row =
                button.closest<HTMLElement>(
                  "[data-index]",
                );
  
              const index =
                Number(row?.dataset.index);
  
              ingredientRows.splice(
                index,
                1,
              );
  
              if (
                ingredientRows.length === 0
              ) {
                ingredientRows.push({
                  item: "",
                  quantity: 1,
                });
              }
  
              renderIngredients();
            },
          );
        });
    }
  
  
    function save(): void {
      errorLabel.hidden = true;
  
      const outputItem =
        resolveItemName(
          outputItemInput.value,
          options.catalog,
        );
  
      if (!outputItem) {
        const suggestion =
          searchItems(
            outputItemInput.value,
            options.catalog,
            1,
          )[0];
  
        errorLabel.textContent =
          suggestion
            ? `Did you mean “${suggestion}”?`
            : "Choose a valid output item.";
  
        errorLabel.hidden = false;
        return;
      }
  
      let outputQuantity: number;
  
      try {
        outputQuantity =
          parseQuantityExpression(
            outputQuantityInput.value,
          );
      } catch (error) {
        errorLabel.textContent =
          error instanceof Error
            ? error.message
            : "Invalid output quantity.";
  
        errorLabel.hidden = false;
        return;
      }
  
      const ingredients:
        RecipeIngredient[] = [];
  
      const rows =
        ingredientList
          .querySelectorAll<HTMLElement>(
            ".recipe-ingredient-row",
          );
      
      for (const row of Array.from(rows)) {
        const itemInput =
          row.querySelector<HTMLInputElement>(
            '[data-field="item"]',
          )!;
  
        const quantityInput =
          row.querySelector<HTMLInputElement>(
            '[data-field="quantity"]',
          )!;
  
        const item =
          resolveItemName(
            itemInput.value,
            options.catalog,
          );
  
        if (!item) {
          errorLabel.textContent =
            `Choose a valid ingredient item.`;
  
          errorLabel.hidden = false;
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
              : "Invalid ingredient quantity.";
  
          errorLabel.hidden = false;
          return;
        }
  
        if (quantity <= 0) {
          errorLabel.textContent =
            "Ingredient quantities must be greater than zero.";
  
          errorLabel.hidden = false;
          return;
        }
  
        ingredients.push({
          item,
          quantity,
        });
      }
  
      options.onSave({
        outputItem,
        outputQuantity,
        ingredients,
      });
  
      close();
    }
  
  
    dialog
      .querySelector<HTMLButtonElement>(
        "#add-recipe-ingredient",
      )!
      .addEventListener(
        "click",
        () => {
          ingredientRows.push({
            item: "",
            quantity: 1,
          });
  
          renderIngredients();
        },
      );
  
    dialog
      .querySelector<HTMLButtonElement>(
        "#save-recipe",
      )!
      .addEventListener("click", save);
  
    dialog
      .querySelector<HTMLButtonElement>(
        "#cancel-recipe",
      )!
      .addEventListener("click", close);
  
    dialog
      .querySelector<HTMLButtonElement>(
        ".dialog-close-button",
      )!
      .addEventListener("click", close);
  
    backdrop.addEventListener(
      "mousedown",
      (event) => {
        if (event.target === backdrop) {
          close();
        }
      },
    );
  
    renderIngredients();
  
    window.setTimeout(() => {
      outputItemInput.focus();
    });
  }