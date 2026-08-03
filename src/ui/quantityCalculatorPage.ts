import {
    createQuantityBreakdown,
    parseQuantityExpression,
  } from "../utils/quantityParser.ts";
  
  interface QuantityCalculatorPageOptions {
    setStatus: (message: string) => void;
  }
  
  function formatNumber(value: number): string {
    if (value > 0 && value < 0.01) {
      return "<0.01";
    }
  
    return value
      .toFixed(2)
      .replace(/\.?0+$/, "");
  }
  
  function formatStackMixed(
    wholeStacks: number,
    remainderItems: number,
  ): string {
    const parts: string[] = [];
  
    if (wholeStacks > 0) {
      parts.push(`${wholeStacks}s`);
    }
  
    if (remainderItems > 0 || parts.length === 0) {
      parts.push(`${formatNumber(remainderItems)} items`);
    }
  
    return parts.join(" + ");
  }
  
  function formatChestMixed(
    chestAmount: number,
    chestSuffix: "sc" | "dc",
    remainderStacks: number,
    remainderItems: number,
  ): string {
    const parts: string[] = [];
  
    if (chestAmount > 0) {
      parts.push(`${chestAmount}${chestSuffix}`);
    }
  
    if (remainderStacks > 0) {
      parts.push(`${remainderStacks}s`);
    }
  
    if (remainderItems > 0 || parts.length === 0) {
      parts.push(`${formatNumber(remainderItems)} items`);
    }
  
    return parts.join(" + ");
  }
  
  export function renderQuantityCalculatorPage(
    container: HTMLElement,
    options: QuantityCalculatorPageOptions,
  ): void {
    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="page-eyebrow">
            Quantity tools
          </span>
  
          <h2>Quantity Calculator</h2>
  
          <p>
            Evaluate item amounts using math, stacks,
            single chests, and double chests.
          </p>
        </div>
      </section>
  
      <section class="content-card quantity-calculator-card">
        <label>
          Quantity expression
  
          <input
            id="quantity-expression"
            type="text"
            autocomplete="off"
            placeholder="Example: 1dc + 5s + 12 items"
          />
        </label>
  
        <div class="quantity-examples">
          <span>Examples:</span>
          <button type="button" data-example="30 * 40">
            30 * 40
          </button>
          <button type="button" data-example="32.19s">
            32.19s
          </button>
          <button type="button" data-example="1dc + 5s + 12">
            1dc + 5s + 12
          </button>
          <button type="button" data-example="(2dc + 1sc) / 3">
            (2dc + 1sc) / 3
          </button>
        </div>
  
        <div class="quantity-action-row">
          <button
            id="calculate-quantity"
            class="primary-button"
            type="button"
          >
            Calculate quantity
          </button>
  
          <button
            id="clear-quantity"
            class="secondary-button"
            type="button"
          >
            Clear
          </button>
        </div>
  
        <p
          id="quantity-error"
          class="form-error"
          hidden
        ></p>
      </section>
  
      <section
        id="quantity-results-card"
        class="content-card quantity-results-card"
        hidden
      >
        <div class="quantity-results-header">
          <div>
            <span class="page-eyebrow">
              Converted quantities
            </span>
  
            <h3>Results</h3>
          </div>
  
          <button
            id="copy-quantity-results"
            class="secondary-button"
            type="button"
          >
            Copy results
          </button>
        </div>
  
        <div id="quantity-results" class="quantity-results"></div>
      </section>
    `;
  
    const expressionInput =
      container.querySelector<HTMLInputElement>(
        "#quantity-expression",
      )!;
  
    const calculateButton =
      container.querySelector<HTMLButtonElement>(
        "#calculate-quantity",
      )!;
  
    const clearButton =
      container.querySelector<HTMLButtonElement>(
        "#clear-quantity",
      )!;
  
    const errorLabel =
      container.querySelector<HTMLParagraphElement>(
        "#quantity-error",
      )!;
  
    const resultsCard =
      container.querySelector<HTMLElement>(
        "#quantity-results-card",
      )!;
  
    const resultsContainer =
      container.querySelector<HTMLDivElement>(
        "#quantity-results",
      )!;
  
    const copyButton =
      container.querySelector<HTMLButtonElement>(
        "#copy-quantity-results",
      )!;
  
    let latestPlainText = "";
  
    function showError(message: string): void {
      errorLabel.textContent = message;
      errorLabel.hidden = false;
      resultsCard.hidden = true;
    }
  
    function clearError(): void {
      errorLabel.textContent = "";
      errorLabel.hidden = true;
    }
  
    function calculate(): void {
      clearError();
  
      try {
        const totalItems =
          parseQuantityExpression(
            expressionInput.value,
          );
  
        const result =
          createQuantityBreakdown(totalItems);
  
        const stackMixed =
          formatStackMixed(
            result.stacksWhole,
            result.remainderItems,
          );
  
        const singleChestMixed =
          formatChestMixed(
            result.singleChestsWhole,
            "sc",
            result.singleChestRemainderStacks,
            result.singleChestRemainderItems,
          );
  
        const doubleChestMixed =
          formatChestMixed(
            result.doubleChestsWhole,
            "dc",
            result.doubleChestRemainderStacks,
            result.doubleChestRemainderItems,
          );
  
          const rows = [
            {
              label: "Items",
              value: `${formatNumber(result.totalItems)} items`,
            },
            {
              label: "Stacks",
              value: `${formatNumber(result.stacks)} stacks`,
            },
            {
              label: "Single chests",
              value: `${formatNumber(result.singleChests)}sc`,
            },
            {
              label: "Double chests",
              value: `${formatNumber(result.doubleChests)}dc`,
            },
            {
              label: "Stacks + remainder",
              value: stackMixed,
            },
          ];
          
          if (singleChestMixed !== stackMixed) {
            rows.push({
              label: "Single chest breakdown",
              value: singleChestMixed,
            });
          }
          
          if (
            doubleChestMixed !== stackMixed &&
            doubleChestMixed !== singleChestMixed
          ) {
            rows.push({
              label: "Double chest breakdown",
              value: doubleChestMixed,
            });
          }
  
        resultsContainer.innerHTML = rows
          .map(
            (row) => `
              <div class="quantity-result-row">
                <span>${row.label}</span>
  
                <strong>
                    ${row.value}
                </strong>
              </div>
            `,
          )
          .join("");
  
          const copiedRows = [
            `Items: ${formatNumber(result.totalItems)} items`,
            `Stacks: ${formatNumber(result.stacks)} stacks`,
            `Single chests: ${formatNumber(result.singleChests)} single chests`,
            `Double chests: ${formatNumber(result.doubleChests)} double chests`,
            `Stacks + remainder: ${stackMixed}`,
          ];
          
          if (singleChestMixed !== stackMixed) {
            copiedRows.push(
              `Single chest breakdown: ${singleChestMixed}`,
            );
          }
          
          if (
            doubleChestMixed !== stackMixed &&
            doubleChestMixed !== singleChestMixed
          ) {
            copiedRows.push(
              `Double chest breakdown: ${doubleChestMixed}`,
            );
          }
          
          latestPlainText = copiedRows.join("\n");
  
        resultsCard.hidden = false;
  
        options.setStatus(
          `Calculated ${formatNumber(result.totalItems)} items`,
        );
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "The quantity could not be calculated.",
        );
  
        options.setStatus(
          "Quantity calculation failed",
        );
      }
    }
  
    calculateButton.addEventListener(
      "click",
      calculate,
    );
  
    clearButton.addEventListener(
      "click",
      () => {
        expressionInput.value = "";
        latestPlainText = "";
        resultsCard.hidden = true;
        clearError();
        expressionInput.focus();
  
        options.setStatus(
          "Quantity calculator cleared",
        );
      },
    );
  
    expressionInput.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          calculate();
        }
      },
    );
  
    container
      .querySelectorAll<HTMLButtonElement>(
        "[data-example]",
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            expressionInput.value =
              button.dataset.example ?? "";
  
            calculate();
          },
        );
      });
  
    copyButton.addEventListener(
      "click",
      async () => {
        if (!latestPlainText) {
          return;
        }
  
        await navigator.clipboard.writeText(
          latestPlainText,
        );
  
        options.setStatus(
          "Quantity results copied",
        );
      },
    );
  
    expressionInput.focus();
  }