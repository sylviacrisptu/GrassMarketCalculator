import type { ItemCatalog } from "../data/itemCatalog.ts";

import {
  subscribeToListings,
  toggleListingFavorite,
} from "../state/appState.ts";

import type { MarketListing } from "../types/listing.ts";

import { openListingActions } from "./listingActions.ts";

import {
    renderItemIdentity,
  } from "../components/itemIdentity.ts";

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


function formatSeller(listing: MarketListing): string {
  if (listing.universalPrice) {
    return "Universal";
  }

  return listing.seller || "—";
}


function formatStock(listing: MarketListing): string {
  if (listing.universalPrice) {
    return "∞";
  }

  if (listing.availableStock === null) {
    return "—";
  }

  return formatNumber(listing.availableStock);
}


function formatUpdatedDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}


export function renderMarketPage(
  container: HTMLElement,
  setStatus: (message: string) => void,
  catalog: ItemCatalog,
  initialQuery = "",
): () => void {
  let listings: MarketListing[] = [];

  container.innerHTML = `
    <section class="page-header">
      <div>
        <span class="page-eyebrow">
          All saved offers
        </span>

        <h2>
          Market Prices
        </h2>

        <p>
          Compare buying and selling prices in one place.
        </p>
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
          placeholder="Search items, sellers, coordinates, restocks, or notes…"
          autocomplete="off"
        />

        <select
          id="market-type"
          aria-label="Filter listing type"
        >
          <option value="all">
            Buying and selling
          </option>

          <option value="buying">
            Buying only
          </option>

          <option value="selling">
            Selling only
          </option>
        </select>

        <label class="checkbox-label">
          <input
            id="market-favorites"
            type="checkbox"
          />

          Favorites only
        </label>

        <select
          id="market-sort"
          aria-label="Sort market listings"
        >
          <option value="name">
            Name A–Z
          </option>

          <option value="cheapest">
            Cheapest price
          </option>

          <option value="highest">
            Highest price
          </option>

          <option value="recent">
            Recently updated
          </option>

          <option value="favorites">
            Favorites first
          </option>
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
              <th>Stock</th>
              <th>Updated</th>
              <th class="actions-column"></th>
            </tr>
          </thead>

          <tbody id="market-table-body"></tbody>
        </table>
      </div>

      <div
        id="market-empty"
        class="empty-state"
        hidden
      >
        No market listings match these filters.
      </div>
    </section>
  `;

  const filterInput =
    container.querySelector<HTMLInputElement>(
      "#market-filter",
    )!;

  const typeSelect =
    container.querySelector<HTMLSelectElement>(
      "#market-type",
    )!;

  const favoritesOnly =
    container.querySelector<HTMLInputElement>(
      "#market-favorites",
    )!;

  const sortSelect =
    container.querySelector<HTMLSelectElement>(
      "#market-sort",
    )!;

  const tableBody =
    container.querySelector<HTMLTableSectionElement>(
      "#market-table-body",
    )!;

  const emptyState =
    container.querySelector<HTMLDivElement>(
      "#market-empty",
    )!;

  const count =
    container.querySelector<HTMLElement>(
      "#market-count",
    )!;

  filterInput.value = initialQuery;


  function openActionsForListing(
    listingId: string,
    x: number,
    y: number,
  ): void {
    openListingActions({
      listingId,
      x,
      y,
      catalog,
      setStatus,
    });
  }


  function render(): void {
    const query =
      filterInput.value.trim().toLowerCase();

    let visible = listings.filter(
      (listing) => {
        if (
          typeSelect.value !== "all" &&
          listing.type !== typeSelect.value
        ) {
          return false;
        }

        if (
          favoritesOnly.checked &&
          !listing.favorite
        ) {
          return false;
        }

        const searchableText = [
          listing.item,
          listing.seller,
          listing.shopCoordinates,
          listing.restockDetails,
          listing.notes,
          listing.type,
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      },
    );

    switch (sortSelect.value) {
      case "cheapest":
        visible.sort(
          (a, b) =>
            a.pricePerItem - b.pricePerItem,
        );
        break;

      case "highest":
        visible.sort(
          (a, b) =>
            b.pricePerItem - a.pricePerItem,
        );
        break;

      case "recent":
        visible.sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt),
        );
        break;

      case "favorites":
        visible.sort((a, b) => {
          if (a.favorite !== b.favorite) {
            return Number(b.favorite) - Number(a.favorite);
          }

          return a.item.localeCompare(b.item);
        });
        break;

      default:
        visible.sort(
          (a, b) =>
            a.item.localeCompare(b.item),
        );
        break;
    }

    count.textContent = String(listings.length);

    tableBody.innerHTML = visible
      .map(
        (listing) => `
          <tr data-id="${escapeHtml(listing.id)}">
            <td class="favorite-column">
              <button
                class="favorite-button"
                data-action="favorite"
                type="button"
                aria-label="${
                  listing.favorite
                    ? "Remove from favorites"
                    : "Mark as favorite"
                }"
                title="${
                  listing.favorite
                    ? "Remove from favorites"
                    : "Mark as favorite"
                }"
              >
                ${listing.favorite ? "★" : "☆"}
              </button>
            </td>

            <td>
              <span class="listing-type ${listing.type}">
                ${
                  listing.type === "buying"
                    ? "BUYING"
                    : "SELLING"
                }
              </span>
            </td>

            <td>
                ${renderItemIdentity(listing)}
            </td>

            <td>
              ${formatNumber(listing.quantity)}
            </td>

            <td>
              ${formatNumber(listing.grassPrice)}g
            </td>

            <td>
              <span class="price-pill ${listing.type}">
                ${formatNumber(listing.pricePerItem)}g
              </span>
            </td>

            <td>
              ${escapeHtml(formatSeller(listing))}
            </td>

            <td>
              ${formatStock(listing)}
            </td>

            <td>
              ${escapeHtml(formatUpdatedDate(listing.updatedAt))}
            </td>

            <td class="actions-column">
              <button
                class="row-menu-button"
                data-action="menu"
                type="button"
                aria-label="Listing actions"
                title="Listing actions"
              >
                ⋯
              </button>
            </td>
          </tr>
        `,
      )
      .join("");

    const table =
      tableBody.closest<HTMLTableElement>(
        "table",
      )!;

    table.hidden = visible.length === 0;
    emptyState.hidden = visible.length !== 0;

    tableBody
      .querySelectorAll<HTMLTableRowElement>(
        "tr[data-id]",
      )
      .forEach((row) => {
        row.addEventListener(
          "contextmenu",
          (event) => {
            event.preventDefault();

            const listingId = row.dataset.id;

            if (!listingId) {
              return;
            }

            openActionsForListing(
              listingId,
              event.clientX,
              event.clientY,
            );
          },
        );
      });

    tableBody
      .querySelectorAll<HTMLButtonElement>(
        "button[data-action]",
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          (event) => {
            event.stopPropagation();

            const row =
              button.closest<HTMLTableRowElement>(
                "tr[data-id]",
              );

            const listingId = row?.dataset.id;

            if (!listingId) {
              return;
            }

            if (
              button.dataset.action === "favorite"
            ) {
              toggleListingFavorite(listingId);

              const listing =
                listings.find(
                  (entry) =>
                    entry.id === listingId,
                );

              if (listing) {
                setStatus(
                  listing.favorite
                    ? `Removed ${listing.item} from favorites`
                    : `Favorited ${listing.item}`,
                );
              }

              return;
            }

            if (
              button.dataset.action === "menu"
            ) {
              const rect =
                button.getBoundingClientRect();

              openActionsForListing(
                listingId,
                rect.right,
                rect.bottom,
              );
            }
          },
        );
      });
  }


  filterInput.addEventListener(
    "input",
    render,
  );

  typeSelect.addEventListener(
    "change",
    render,
  );

  favoritesOnly.addEventListener(
    "change",
    render,
  );

  sortSelect.addEventListener(
    "change",
    render,
  );

  return subscribeToListings(
    (nextListings) => {
      listings = nextListings;
      render();
    },
  );
}