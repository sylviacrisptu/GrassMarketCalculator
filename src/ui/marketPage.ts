import {
    deleteListing,
    subscribeToListings,
    toggleListingFavorite,
  } from "../state/appState.ts";
  import type { MarketListing } from "../types/listing.ts";
  
  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
  
  function formatNumber(value: number): string {
    if (value > 0 && value < 0.01) {
      return "<0.01";
    }
  
    return value.toFixed(2).replace(/\.?0+$/, "");
  }
  
  export function renderMarketPage(
    container: HTMLElement,
    setStatus: (message: string) => void,
    initialQuery = "",
  ): () => void {
    let listings: MarketListing[] = [];
  
    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="page-eyebrow">All saved offers</span>
          <h2>Market Prices</h2>
          <p>Compare buying and selling prices in one place.</p>
        </div>
  
        <div class="page-stat">
          <strong id="market-count">0</strong>
          <span>market listings</span>
        </div>
      </section>
  
      <section class="results-card">
        <div class="table-toolbar">
          <input
            id="market-filter"
            type="search"
            placeholder="Search items, sellers, or notes…"
          />
  
          <select id="market-type">
            <option value="all">Buying and selling</option>
            <option value="buying">Buying only</option>
            <option value="selling">Selling only</option>
          </select>
  
          <label class="checkbox-label">
            <input id="market-favorites" type="checkbox" />
            Favorites only
          </label>
  
          <select id="market-sort">
            <option value="name">Name A–Z</option>
            <option value="cheapest">Cheapest price</option>
            <option value="highest">Highest price</option>
            <option value="recent">Recently updated</option>
          </select>
        </div>
  
        <div class="listing-table-wrapper">
          <table class="listing-table">
            <thead>
              <tr>
                <th class="favorite-column">★</th>
                <th>Type</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>Grass</th>
                <th>Per item</th>
                <th>Seller</th>
                <th class="actions-column"></th>
              </tr>
            </thead>
  
            <tbody id="market-table-body"></tbody>
          </table>
        </div>
  
        <div id="market-empty" class="empty-state" hidden>
          No market listings match these filters.
        </div>
      </section>
    `;
  
    const filterInput =
      container.querySelector<HTMLInputElement>("#market-filter")!;
    const typeSelect =
      container.querySelector<HTMLSelectElement>("#market-type")!;
    const favoritesOnly =
      container.querySelector<HTMLInputElement>("#market-favorites")!;
    const sortSelect =
      container.querySelector<HTMLSelectElement>("#market-sort")!;
    const tableBody =
      container.querySelector<HTMLTableSectionElement>("#market-table-body")!;
    const emptyState =
      container.querySelector<HTMLDivElement>("#market-empty")!;
    const count =
      container.querySelector<HTMLElement>("#market-count")!;

    filterInput.value = initialQuery;
  
    function render(): void {
      const query = filterInput.value.trim().toLowerCase();
  
      let visible = listings.filter((listing) => {
        if (
          typeSelect.value !== "all" &&
          listing.type !== typeSelect.value
        ) {
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
        case "cheapest":
          visible.sort((a, b) => a.pricePerItem - b.pricePerItem);
          break;
  
        case "highest":
          visible.sort((a, b) => b.pricePerItem - a.pricePerItem);
          break;
  
        case "recent":
          visible.sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt)
          );
          break;
  
        default:
          visible.sort((a, b) => a.item.localeCompare(b.item));
          break;
      }
  
      count.textContent = String(listings.length);
  
      tableBody.innerHTML = visible
        .map(
          (listing) => `
            <tr data-id="${listing.id}">
              <td class="favorite-column">
                <button
                  class="favorite-button"
                  data-action="favorite"
                  type="button"
                >
                  ${listing.favorite ? "★" : "☆"}
                </button>
              </td>
  
              <td>
                <span class="listing-type ${listing.type}">
                  ${listing.type === "buying" ? "BUYING" : "SELLING"}
                </span>
              </td>
  
              <td>
                <strong>${escapeHtml(listing.item)}</strong>
              </td>
  
              <td>${formatNumber(listing.quantity)}</td>
              <td>${formatNumber(listing.grassPrice)}g</td>
  
              <td>
                <span class="price-pill ${listing.type}">
                  ${formatNumber(listing.pricePerItem)}g
                </span>
              </td>
  
              <td>${escapeHtml(listing.seller || "—")}</td>
  
              <td class="actions-column">
                <button
                  class="delete-button"
                  data-action="delete"
                  type="button"
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
            const id =
              button.closest<HTMLTableRowElement>("tr")?.dataset.id;
  
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
  
    filterInput.addEventListener("input", render);
    typeSelect.addEventListener("change", render);
    favoritesOnly.addEventListener("change", render);
    sortSelect.addEventListener("change", render);
  
    return subscribeToListings((nextListings) => {
      listings = nextListings;
      render();
    });
  }