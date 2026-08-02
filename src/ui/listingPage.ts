import {
    resolveItemName,
    searchItems,
    type ItemCatalog,
  } from "../data/itemCatalog.ts";
  import { parseListingExpression } from "../parsers/listingParser.ts";
  import {
    addListing,
    deleteListing,
    subscribeToListings,
    toggleListingFavorite,
  } from "../state/appState.ts";
  import type {
    ListingType,
    MarketListing,
  } from "../types/listing.ts";
  
  function createId(): string {
    return crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  
    return value.toFixed(2).replace(/\.?0+$/, "");
  }
  
  interface ListingPageOptions {
    type: ListingType;
    catalog: ItemCatalog;
    setStatus: (message: string) => void;
  }
  
  export function renderListingPage(
    container: HTMLElement,
    options: ListingPageOptions,
  ): () => void {
    const { type, catalog, setStatus } = options;
    const isBuying = type === "buying";
  
    let currentListings: MarketListing[] = [];
    let selectedSuggestion = -1;
  
    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="page-eyebrow">
            ${isBuying ? "Spend grass blocks" : "Receive grass blocks"}
          </span>
  
          <h2>${isBuying ? "Buying Items" : "Selling Items"}</h2>
  
          <p>
            ${
              isBuying
                ? "Compare prices and find the cheapest way to obtain an item."
                : "Track offers and compare the best return for items you sell."
            }
          </p>
        </div>
  
        <div class="page-stat">
          <strong id="listing-count">0</strong>
          <span>saved listings</span>
        </div>
      </section>
  
      <section class="entry-card">
        <div class="entry-grid">
          <label>
            Item
  
            <div class="autocomplete-wrapper">
              <input
                id="listing-item"
                type="text"
                autocomplete="off"
                placeholder="Search Minecraft items…"
              />
  
              <div
                id="item-suggestions"
                class="suggestions"
                hidden
              ></div>
            </div>
          </label>
  
          <label>
            Price listing
  
            <input
              id="listing-expression"
              type="text"
              placeholder="Example: 12 for 21g"
            />
          </label>
  
          <label>
            Seller
            <input
              id="listing-seller"
              type="text"
              placeholder="Optional"
            />
          </label>
  
          <button id="add-listing" class="primary-button">
            Add ${isBuying ? "buying" : "selling"} listing
          </button>
        </div>
  
        <label class="notes-field">
          Notes
          <textarea
            id="listing-notes"
            rows="2"
            placeholder="Optional notes, shop location, restock details…"
          ></textarea>
        </label>
  
        <p id="listing-error" class="form-error" hidden></p>
      </section>
  
      <section class="results-card">
        <div class="table-toolbar">
          <input
            id="listing-filter"
            type="search"
            placeholder="Filter ${type} listings…"
          />
  
          <label class="checkbox-label">
            <input id="favorites-only" type="checkbox" />
            Favorites only
          </label>
  
          <select id="listing-sort">
            <option value="best">
              ${isBuying ? "Cheapest first" : "Highest return first"}
            </option>
  
            <option value="worst">
              ${isBuying ? "Most expensive first" : "Lowest return first"}
            </option>
  
            <option value="name">Name A–Z</option>
            <option value="recent">Recently updated</option>
          </select>
        </div>
  
        <div class="listing-table-wrapper">
          <table class="listing-table">
            <thead>
              <tr>
                <th class="favorite-column">★</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>Grass</th>
                <th>Per item</th>
                <th>Seller</th>
                <th>Updated</th>
                <th class="actions-column"></th>
              </tr>
            </thead>
  
            <tbody id="listing-table-body"></tbody>
          </table>
        </div>
  
        <div id="listing-empty" class="empty-state" hidden>
          No matching ${type} listings.
        </div>
      </section>
    `;
  
    const itemInput =
      container.querySelector<HTMLInputElement>("#listing-item")!;
    const expressionInput =
      container.querySelector<HTMLInputElement>("#listing-expression")!;
    const sellerInput =
      container.querySelector<HTMLInputElement>("#listing-seller")!;
    const notesInput =
      container.querySelector<HTMLTextAreaElement>("#listing-notes")!;
    const addButton =
      container.querySelector<HTMLButtonElement>("#add-listing")!;
    const suggestionBox =
      container.querySelector<HTMLDivElement>("#item-suggestions")!;
    const errorLabel =
      container.querySelector<HTMLParagraphElement>("#listing-error")!;
    const filterInput =
      container.querySelector<HTMLInputElement>("#listing-filter")!;
    const favoritesOnly =
      container.querySelector<HTMLInputElement>("#favorites-only")!;
    const sortSelect =
      container.querySelector<HTMLSelectElement>("#listing-sort")!;
    const tableBody =
      container.querySelector<HTMLTableSectionElement>("#listing-table-body")!;
    const emptyState =
      container.querySelector<HTMLDivElement>("#listing-empty")!;
    const listingCount =
      container.querySelector<HTMLElement>("#listing-count")!;
  
    function showError(message: string): void {
      errorLabel.textContent = message;
      errorLabel.hidden = false;
    }
  
    function clearError(): void {
      errorLabel.textContent = "";
      errorLabel.hidden = true;
    }
  
    function getSuggestions(): string[] {
      return searchItems(itemInput.value, catalog, 30);
    }
  
    function renderSuggestions(): void {
      selectedSuggestion = -1;
  
      if (!itemInput.value.trim()) {
        suggestionBox.hidden = true;
        return;
      }
  
      const suggestions = getSuggestions();
  
      if (suggestions.length === 0) {
        suggestionBox.hidden = true;
        return;
      }
  
      suggestionBox.innerHTML = suggestions
        .map(
          (item, index) => `
            <button
              type="button"
              class="suggestion"
              data-index="${index}"
              data-item="${escapeHtml(item)}"
            >
              ${escapeHtml(item)}
            </button>
          `,
        )
        .join("");
  
      suggestionBox.hidden = false;
  
      suggestionBox
        .querySelectorAll<HTMLButtonElement>(".suggestion")
        .forEach((button) => {
          button.addEventListener("mousedown", (event) => {
            event.preventDefault();
            itemInput.value = button.dataset.item ?? "";
            suggestionBox.hidden = true;
            expressionInput.focus();
          });
        });
    }
  
    function acceptSuggestion(): boolean {
      const suggestions = getSuggestions();
  
      if (suggestions.length === 0) {
        return false;
      }
  
      itemInput.value =
        suggestions[selectedSuggestion >= 0 ? selectedSuggestion : 0];
  
      suggestionBox.hidden = true;
      return true;
    }
  
    function highlightSuggestion(): void {
      const buttons =
        suggestionBox.querySelectorAll<HTMLButtonElement>(".suggestion");
  
      buttons.forEach((button, index) => {
        button.classList.toggle("selected", index === selectedSuggestion);
      });
  
      buttons[selectedSuggestion]?.scrollIntoView({
        block: "nearest",
      });
    }
  
    function renderTable(): void {
      const query = filterInput.value.trim().toLowerCase();
  
      let visible = currentListings.filter((listing) => {
        if (listing.type !== type) {
          return false;
        }
  
        if (favoritesOnly.checked && !listing.favorite) {
          return false;
        }
  
        return (
          listing.item.toLowerCase().includes(query) ||
          listing.seller.toLowerCase().includes(query) ||
          listing.notes.toLowerCase().includes(query)
        );
      });
  
      switch (sortSelect.value) {
        case "worst":
          visible.sort((a, b) =>
            isBuying
              ? b.pricePerItem - a.pricePerItem
              : a.pricePerItem - b.pricePerItem
          );
          break;
  
        case "name":
          visible.sort((a, b) => a.item.localeCompare(b.item));
          break;
  
        case "recent":
          visible.sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt)
          );
          break;
  
        default:
          visible.sort((a, b) =>
            isBuying
              ? a.pricePerItem - b.pricePerItem
              : b.pricePerItem - a.pricePerItem
          );
          break;
      }
  
      listingCount.textContent = String(
        currentListings.filter((listing) => listing.type === type).length,
      );
  
      tableBody.innerHTML = visible
        .map(
          (listing) => `
            <tr data-id="${listing.id}">
              <td class="favorite-column">
                <button
                  class="favorite-button"
                  type="button"
                  data-action="favorite"
                  aria-label="Toggle favorite"
                >
                  ${listing.favorite ? "★" : "☆"}
                </button>
              </td>
  
              <td>
                <strong>${escapeHtml(listing.item)}</strong>
  
                ${
                  listing.notes
                    ? `<small class="cell-note">${escapeHtml(listing.notes)}</small>`
                    : ""
                }
              </td>
  
              <td>${formatNumber(listing.quantity)}</td>
              <td>${formatNumber(listing.grassPrice)}g</td>
  
              <td>
                <span class="price-pill ${type}">
                  ${formatNumber(listing.pricePerItem)}g
                </span>
              </td>
  
              <td>${escapeHtml(listing.seller || "—")}</td>
              <td>${new Date(listing.updatedAt).toLocaleString()}</td>
  
              <td class="actions-column">
                <button
                  class="delete-button"
                  type="button"
                  data-action="delete"
                  aria-label="Delete listing"
                >
                  ×
                </button>
              </td>
            </tr>
          `,
        )
        .join("");
  
      const table = tableBody.closest("table")!;
      table.hidden = visible.length === 0;
      emptyState.hidden = visible.length !== 0;
  
      tableBody.querySelectorAll<HTMLButtonElement>("button").forEach(
        (button) => {
          button.addEventListener("click", () => {
            const row = button.closest<HTMLTableRowElement>("tr");
            const id = row?.dataset.id;
  
            if (!id) {
              return;
            }
  
            if (button.dataset.action === "favorite") {
              toggleListingFavorite(id);
            }
  
            if (button.dataset.action === "delete") {
              deleteListing(id);
              setStatus("Listing deleted");
            }
          });
        },
      );
    }
  
    function submitListing(): void {
      clearError();
  
      const enteredItem = itemInput.value.trim();
      const canonicalItem = resolveItemName(enteredItem, catalog);
  
      if (!canonicalItem) {
        const suggestion = searchItems(enteredItem, catalog, 1)[0];
  
        showError(
          suggestion
            ? `Did you mean “${suggestion}”?`
            : "No matching Minecraft 1.19.2 item was found.",
        );
  
        return;
      }
  
      try {
        const parsed = parseListingExpression(expressionInput.value);
        const now = new Date().toISOString();
  
        addListing({
          id: createId(),
          type,
          item: canonicalItem,
          quantity: parsed.quantity,
          grassPrice: parsed.grassPrice,
          pricePerItem: parsed.pricePerItem,
          favorite: false,
          seller: sellerInput.value.trim(),
          notes: notesInput.value.trim(),
          createdAt: now,
          updatedAt: now,
        });
  
        setStatus(
          `Added ${type} listing for ${canonicalItem}`,
        );
  
        itemInput.value = "";
        expressionInput.value = "";
        sellerInput.value = "";
        notesInput.value = "";
  
        itemInput.focus();
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "The listing could not be added.",
        );
      }
    }
  
    itemInput.addEventListener("input", renderSuggestions);
  
    itemInput.addEventListener("keydown", (event) => {
      const suggestions = getSuggestions();
  
      if (event.key === "ArrowDown" && !suggestionBox.hidden) {
        event.preventDefault();
  
        selectedSuggestion = Math.min(
          selectedSuggestion + 1,
          suggestions.length - 1,
        );
  
        highlightSuggestion();
      }
  
      if (event.key === "ArrowUp" && !suggestionBox.hidden) {
        event.preventDefault();
        selectedSuggestion = Math.max(selectedSuggestion - 1, 0);
        highlightSuggestion();
      }
  
      if (event.key === "Tab" && suggestions.length > 0) {
        event.preventDefault();
        acceptSuggestion();
        expressionInput.focus();
      }
  
      if (event.key === "Enter") {
        if (!suggestionBox.hidden && suggestions.length > 0) {
          event.preventDefault();
          acceptSuggestion();
          expressionInput.focus();
        } else {
          expressionInput.focus();
        }
      }
  
      if (event.key === "Escape") {
        suggestionBox.hidden = true;
      }
    });
  
    itemInput.addEventListener("blur", () => {
      window.setTimeout(() => {
        suggestionBox.hidden = true;
      }, 100);
    });
  
    expressionInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        submitListing();
      }
    });
  
    addButton.addEventListener("click", submitListing);
    filterInput.addEventListener("input", renderTable);
    favoritesOnly.addEventListener("change", renderTable);
    sortSelect.addEventListener("change", renderTable);
  
    const unsubscribe = subscribeToListings((listings) => {
      currentListings = listings;
      renderTable();
    });
  
    return unsubscribe;
  }