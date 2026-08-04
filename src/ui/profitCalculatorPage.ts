import {
    resolveItemName,
    searchItems,
    type ItemCatalog,
  } from "../data/itemCatalog.ts";
  
  import {
    addListing,
    getListings,
    subscribeToListings,
  } from "../state/appState.ts";
  
  import type {
    ListingType,
    MarketListing,
  } from "../types/listing.ts";
  
  import {
    calculateAcquisitionPlan,
    calculateRevenuePlan,
    type ListingAllocation,
  } from "../utils/profitCalculator.ts";
  
  import {
    parseQuantityExpression,
  } from "../utils/quantityParser.ts";
  
  import {
    openListingEditor,
  } from "./listingEditor.ts";
  
  
  interface ProfitCalculatorPageOptions {
    catalog: ItemCatalog;
    setStatus: (message: string) => void;
    initialItem?: string;
  }
  
  
  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  
  function formatNumber(value: number): string {
    if (value > 0 && value < 0.01) {
      return "<0.01";
    }
  
    return value
      .toFixed(2)
      .replace(/\.?0+$/, "");
  }
  
  
  function formatGrass(value: number): string {
    if (value > 0 && value < 0.01) {
      return "<0.01g";
    }
  
    if (value < 0 && value > -0.01) {
      return ">-0.01g";
    }
  
    return `${formatNumber(value)}g`;
  }
  
  
  function formatSeller(
    listing: MarketListing,
  ): string {
    if (listing.universalPrice) {
      return "Universal price";
    }
  
    return listing.seller || "Unknown seller";
  }
  
  
  function renderAllocation(
    allocation: ListingAllocation,
    mode: "cost" | "revenue",
  ): string {
    const listing = allocation.listing;
  
    return `
      <article class="profit-source-row">
        <div class="profit-source-main">
          <strong>
            ${escapeHtml(formatSeller(listing))}
          </strong>
  
          <span>
            ${formatNumber(allocation.quantity)} items
            at ${formatGrass(listing.pricePerItem)} each
          </span>
        </div>
  
        <div class="profit-source-details">
          <span>
            ${formatNumber(allocation.bundles)}
            listing bundle${
              allocation.bundles === 1 ? "" : "s"
            }
          </span>
  
          <strong class="${mode}">
            ${formatGrass(allocation.totalGrass)}
          </strong>
        </div>
      </article>
    `;
  }
  
  
  export function renderProfitCalculatorPage(
    container: HTMLElement,
    options: ProfitCalculatorPageOptions,
  ): () => void {
    let listings = getListings();
    let selectedSuggestion = -1;
    let latestPlainText = "";
  
    container.innerHTML = `
      <section class="page-header centered-page-header">
        <div>
          <h2>Profit Calculator</h2>
          <p class="page-description">
            Compare acquisition costs with selling revenue using your current market listings.
          </p>
        </div>
      </section>
  
      <section class="content-card profit-calculator-card">
        <div class="profit-input-grid">
          <label>
            Item
  
            <div class="autocomplete-wrapper">
              <input
                id="profit-item"
                type="text"
                autocomplete="off"
                placeholder="Search Minecraft items…"
              />
  
              <div
                id="profit-item-suggestions"
                class="suggestions"
                hidden
              ></div>
            </div>
          </label>
  
          <label>
            Quantity to trade
  
            <input
              id="profit-quantity"
              type="text"
              autocomplete="off"
              placeholder="Example: 23 stacks"
              value="1 stack"
            />
          </label>
        </div>
  
        <p class="profit-help">
          The calculator buys from the cheapest available
          listings and sells to the highest-paying listings.
        </p>
  
        <div class="quantity-action-row">
          <button
            id="calculate-profit"
            class="primary-button"
            type="button"
          >
            Calculate profit
          </button>
  
          <button
            id="clear-profit"
            class="secondary-button"
            type="button"
          >
            Clear
          </button>
        </div>
  
        <div
          id="profit-listing-actions"
          class="profit-listing-actions"
          hidden
        >
          <div>
            <strong id="profit-listing-actions-title">
              Missing market listings
            </strong>
  
            <span id="profit-listing-actions-description">
              Add pricing data for this item.
            </span>
          </div>
  
          <div class="profit-listing-action-buttons">
            <button
              id="profit-add-buying"
              class="secondary-button"
              type="button"
            >
              Add buying listing
            </button>
  
            <button
              id="profit-add-selling"
              class="secondary-button"
              type="button"
            >
              Add selling listing
            </button>
          </div>
        </div>
  
        <p
          id="profit-error"
          class="form-error"
          hidden
        ></p>
      </section>
  
      <section
        id="profit-results-card"
        class="content-card profit-results-card"
        hidden
      >
        <div class="profit-results-header">
          <div>
            <span class="page-eyebrow">
              Estimated trade
            </span>
  
            <h3 id="profit-results-title">
              Results
            </h3>
          </div>
  
          <button
            id="copy-profit-results"
            class="secondary-button"
            type="button"
          >
            Copy results
          </button>
        </div>
  
        <div
          id="profit-warning"
          class="profit-warning"
          hidden
        ></div>
  
        <div
          id="profit-summary"
          class="profit-summary"
        ></div>
  
        <div class="profit-plan-grid">
          <section class="profit-plan">
            <div class="profit-plan-header">
              <div>
                <span class="page-eyebrow">
                  Acquisition
                </span>
  
                <h4>Items to buy</h4>
              </div>
  
              <strong
                id="profit-cost-total"
                class="profit-total cost"
              ></strong>
            </div>
  
            <div
              id="profit-buy-sources"
              class="profit-source-list"
            ></div>
          </section>
  
          <section class="profit-plan">
            <div class="profit-plan-header">
              <div>
                <span class="page-eyebrow">
                  Revenue
                </span>
  
                <h4>Items to sell</h4>
              </div>
  
              <strong
                id="profit-revenue-total"
                class="profit-total revenue"
              ></strong>
            </div>
  
            <div
              id="profit-sell-sources"
              class="profit-source-list"
            ></div>
          </section>
        </div>
      </section>
    `;
  
    const itemInput =
      container.querySelector<HTMLInputElement>(
        "#profit-item",
      )!;
  
    const quantityInput =
      container.querySelector<HTMLInputElement>(
        "#profit-quantity",
      )!;
  
    const suggestionsBox =
      container.querySelector<HTMLDivElement>(
        "#profit-item-suggestions",
      )!;
  
    const calculateButton =
      container.querySelector<HTMLButtonElement>(
        "#calculate-profit",
      )!;
  
    const clearButton =
      container.querySelector<HTMLButtonElement>(
        "#clear-profit",
      )!;
  
    const errorLabel =
      container.querySelector<HTMLParagraphElement>(
        "#profit-error",
      )!;
  
    const resultsCard =
      container.querySelector<HTMLElement>(
        "#profit-results-card",
      )!;
  
    const resultsTitle =
      container.querySelector<HTMLElement>(
        "#profit-results-title",
      )!;
  
    const warning =
      container.querySelector<HTMLDivElement>(
        "#profit-warning",
      )!;
  
    const summary =
      container.querySelector<HTMLDivElement>(
        "#profit-summary",
      )!;
  
    const buySources =
      container.querySelector<HTMLDivElement>(
        "#profit-buy-sources",
      )!;
  
    const sellSources =
      container.querySelector<HTMLDivElement>(
        "#profit-sell-sources",
      )!;
  
    const costTotal =
      container.querySelector<HTMLElement>(
        "#profit-cost-total",
      )!;
  
    const revenueTotal =
      container.querySelector<HTMLElement>(
        "#profit-revenue-total",
      )!;
  
    const copyButton =
      container.querySelector<HTMLButtonElement>(
        "#copy-profit-results",
      )!;
  
    const listingActions =
      container.querySelector<HTMLDivElement>(
        "#profit-listing-actions",
      )!;
  
    const listingActionsTitle =
      container.querySelector<HTMLElement>(
        "#profit-listing-actions-title",
      )!;
  
    const listingActionsDescription =
      container.querySelector<HTMLElement>(
        "#profit-listing-actions-description",
      )!;
  
    const addBuyingButton =
      container.querySelector<HTMLButtonElement>(
        "#profit-add-buying",
      )!;
  
    const addSellingButton =
      container.querySelector<HTMLButtonElement>(
        "#profit-add-selling",
      )!;
  
    itemInput.value =
      options.initialItem ?? "";
  
  
    function showError(message: string): void {
      errorLabel.textContent = message;
      errorLabel.hidden = false;
      resultsCard.hidden = true;
    }
  
  
    function clearError(): void {
      errorLabel.textContent = "";
      errorLabel.hidden = true;
    }
  
  
    function getCanonicalItem():
      string | null {
      return resolveItemName(
        itemInput.value.trim(),
        options.catalog,
      );
    }
  
  
    function updateListingActions(): void {
      const canonicalItem =
        getCanonicalItem();
  
      if (!canonicalItem) {
        listingActions.hidden = true;
        return;
      }
  
      const itemListings =
        listings.filter(
          (listing) =>
            listing.item.toLowerCase() ===
            canonicalItem.toLowerCase(),
        );
  
      const hasBuying =
        itemListings.some(
          (listing) =>
            listing.type === "buying",
        );
  
      const hasSelling =
        itemListings.some(
          (listing) =>
            listing.type === "selling",
        );
  
      if (hasBuying && hasSelling) {
        listingActions.hidden = true;
        return;
      }
  
      listingActions.hidden = false;
  
      listingActionsTitle.textContent =
        `Add prices for ${canonicalItem}`;
  
      if (!hasBuying && !hasSelling) {
        listingActionsDescription.textContent =
          "There are no buying or selling listings for this item.";
      } else if (!hasBuying) {
        listingActionsDescription.textContent =
          "This item does not have a buying listing.";
      } else {
        listingActionsDescription.textContent =
          "This item does not have a selling listing.";
      }
  
      addBuyingButton.hidden = hasBuying;
      addSellingButton.hidden = hasSelling;
    }
  
  
    function openNewListing(
      type: ListingType,
    ): void {
      const canonicalItem =
        getCanonicalItem();
  
      if (!canonicalItem) {
        showError(
          "Choose a valid Minecraft item first.",
        );
  
        return;
      }
  
      openListingEditor({
        catalog: options.catalog,
        type,
        initialItem: canonicalItem,
  
        onSave: (listing) => {
          addListing(listing);
  
          options.setStatus(
            `Added ${type} listing for ${listing.item}`,
          );
  
          updateListingActions();
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
  
              updateListingActions();
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
  
      itemInput.value =
        suggestions[index];
  
      suggestionsBox.hidden = true;
  
      updateListingActions();
  
      return true;
    }
  
  
    function calculate(): void {
      clearError();
  
      const enteredItem =
        itemInput.value.trim();
  
      const canonicalItem =
        resolveItemName(
          enteredItem,
          options.catalog,
        );
  
      if (!canonicalItem) {
        const suggestion =
          searchItems(
            enteredItem,
            options.catalog,
            1,
          )[0];
  
        showError(
          suggestion
            ? `Did you mean “${suggestion}”?`
            : "No matching Minecraft item was found.",
        );
  
        return;
      }
  
      let quantity: number;
  
      try {
        quantity =
          parseQuantityExpression(
            quantityInput.value,
          );
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "The quantity could not be calculated.",
        );
  
        return;
      }
  
      if (quantity <= 0) {
        showError(
          "Enter a quantity greater than zero.",
        );
  
        return;
      }
  
      const matchingListings =
        listings.filter(
          (listing) =>
            listing.item.toLowerCase() ===
            canonicalItem.toLowerCase(),
        );
  
      const acquisition =
        calculateAcquisitionPlan(
          matchingListings,
          quantity,
        );
  
      const revenue =
        calculateRevenuePlan(
          matchingListings,
          quantity,
        );
  
      if (
        acquisition.allocations.length === 0 &&
        revenue.allocations.length === 0
      ) {
        showError(
          `No buying or selling listings exist for ${canonicalItem}.`,
        );
  
        updateListingActions();
        return;
      }
  
      const tradableQuantity =
        Math.min(
          acquisition.fulfilledQuantity,
          revenue.fulfilledQuantity,
        );
  
      const fullyTradable =
        acquisition.complete &&
        revenue.complete;
  
      const acquisitionRate =
        acquisition.fulfilledQuantity > 0
          ? acquisition.totalGrass /
            acquisition.fulfilledQuantity
          : 0;
  
      const revenueRate =
        revenue.fulfilledQuantity > 0
          ? revenue.totalGrass /
            revenue.fulfilledQuantity
          : 0;
  
      const effectiveCost =
        acquisitionRate *
        tradableQuantity;
  
      const effectiveRevenue =
        revenueRate *
        tradableQuantity;
  
      const profit =
        effectiveRevenue -
        effectiveCost;
  
      const profitPerItem =
        tradableQuantity > 0
          ? profit / tradableQuantity
          : 0;
  
      const profitPerStack =
        profitPerItem * 64;
  
      resultsTitle.textContent =
        `${canonicalItem} · ${formatNumber(quantity)} items`;
  
      summary.innerHTML = `
        <article class="profit-summary-card">
          <span>Acquisition cost</span>
  
          <strong class="cost">
            ${formatGrass(effectiveCost)}
          </strong>
        </article>
  
        <article class="profit-summary-card">
          <span>Expected revenue</span>
  
          <strong class="revenue">
            ${formatGrass(effectiveRevenue)}
          </strong>
        </article>
  
        <article class="profit-summary-card">
          <span>Estimated profit</span>
  
          <strong class="${
            profit >= 0
              ? "positive"
              : "negative"
          }">
            ${formatGrass(profit)}
          </strong>
        </article>
  
        <article class="profit-summary-card">
          <span>Profit per item</span>
  
          <strong class="${
            profitPerItem >= 0
              ? "positive"
              : "negative"
          }">
            ${formatGrass(profitPerItem)}
          </strong>
        </article>
  
        <article class="profit-summary-card">
          <span>Profit per stack</span>
  
          <strong class="${
            profitPerStack >= 0
              ? "positive"
              : "negative"
          }">
            ${formatGrass(profitPerStack)}
          </strong>
        </article>
  
        <article class="profit-summary-card">
          <span>Tradable quantity</span>
  
          <strong>
            ${formatNumber(tradableQuantity)} items
          </strong>
        </article>
      `;
  
      costTotal.textContent =
        formatGrass(
          acquisition.totalGrass,
        );
  
      revenueTotal.textContent =
        formatGrass(
          revenue.totalGrass,
        );
  
      buySources.innerHTML =
        acquisition.allocations.length > 0
          ? acquisition.allocations
              .map((allocation) =>
                renderAllocation(
                  allocation,
                  "cost",
                ),
              )
              .join("")
          : `
            <div class="empty-state">
              No acquisition listings found.
            </div>
          `;
  
      sellSources.innerHTML =
        revenue.allocations.length > 0
          ? revenue.allocations
              .map((allocation) =>
                renderAllocation(
                  allocation,
                  "revenue",
                ),
              )
              .join("")
          : `
            <div class="empty-state">
              No selling listings found.
            </div>
          `;
  
      const warnings: string[] = [];
  
      if (!acquisition.complete) {
        warnings.push(
          `Only ${formatNumber(
            acquisition.fulfilledQuantity,
          )} of ${formatNumber(
            quantity,
          )} items can currently be acquired.`,
        );
      }
  
      if (!revenue.complete) {
        warnings.push(
          `Only ${formatNumber(
            revenue.fulfilledQuantity,
          )} of ${formatNumber(
            quantity,
          )} items can currently be sold.`,
        );
      }
  
      if (
        acquisition.allocations.length === 0
      ) {
        warnings.push(
          "No Buying listing is available, so acquisition cost cannot be fully calculated.",
        );
      }
  
      if (
        revenue.allocations.length === 0
      ) {
        warnings.push(
          "No Selling listing is available, so revenue cannot be fully calculated.",
        );
      }
  
      warning.innerHTML = warnings
        .map(
          (message) => `
            <p>
              ${escapeHtml(message)}
            </p>
          `,
        )
        .join("");
  
      warning.hidden =
        warnings.length === 0;
  
      latestPlainText = [
        canonicalItem,
        `Requested quantity: ${formatNumber(quantity)} items`,
        `Tradable quantity: ${formatNumber(tradableQuantity)} items`,
        `Acquisition cost: ${formatGrass(effectiveCost)}`,
        `Expected revenue: ${formatGrass(effectiveRevenue)}`,
        `Estimated profit: ${formatGrass(profit)}`,
        `Profit per item: ${formatGrass(profitPerItem)}`,
        `Profit per stack: ${formatGrass(profitPerStack)}`,
        fullyTradable
          ? "Market stock: complete"
          : "Market stock: incomplete",
      ].join("\n");
  
      resultsCard.hidden = false;
  
      updateListingActions();
  
      options.setStatus(
        `Calculated ${formatGrass(profit)} profit for ${canonicalItem}`,
      );
    }
  
  
    itemInput.addEventListener(
      "input",
      () => {
        renderSuggestions();
        updateListingActions();
      },
    );
  
  
    itemInput.addEventListener(
      "keydown",
      (event) => {
        const suggestions =
          getSuggestions();
  
        if (
          event.key === "ArrowDown" &&
          !suggestionsBox.hidden
        ) {
          event.preventDefault();
  
          selectedSuggestion =
            Math.min(
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
  
          selectedSuggestion =
            Math.max(
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
  
  
    calculateButton.addEventListener(
      "click",
      calculate,
    );
  
  
    clearButton.addEventListener(
      "click",
      () => {
        itemInput.value = "";
        quantityInput.value = "1 stack";
  
        latestPlainText = "";
  
        clearError();
  
        resultsCard.hidden = true;
        listingActions.hidden = true;
        suggestionsBox.hidden = true;
  
        itemInput.focus();
  
        options.setStatus(
          "Profit calculator cleared",
        );
      },
    );
  
  
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
          "Profit calculation copied",
        );
      },
    );
  
  
    addBuyingButton.addEventListener(
      "click",
      () => {
        openNewListing("buying");
      },
    );
  
  
    addSellingButton.addEventListener(
      "click",
      () => {
        openNewListing("selling");
      },
    );
  
  
    const unsubscribe =
      subscribeToListings(
        (nextListings) => {
          listings = nextListings;
          updateListingActions();
        },
      );
  
    updateListingActions();
  
    if (itemInput.value) {
      quantityInput.focus();
    } else {
      itemInput.focus();
    }
  
    return unsubscribe;
  }