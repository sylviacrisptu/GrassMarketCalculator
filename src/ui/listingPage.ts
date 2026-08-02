import type { ItemCatalog } from "../data/itemCatalog.ts";

import {
    renderItemIdentity,
  } from "../components/itemIdentity.ts";

import {
  addListing,
  subscribeToListings,
  toggleListingFavorite,
} from "../state/appState.ts";

import type {
  ListingType,
  MarketListing,
} from "../types/listing.ts";

import { openListingActions } from "./listingActions.ts";
import { openListingEditor } from "./listingEditor.ts";

import {
    hydrateItemIcons,
  } from "../services/itemIconService.ts";


interface ListingPageOptions {
  type: ListingType;
  catalog: ItemCatalog;
  setStatus: (message: string) => void;
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


function formatStock(listing: MarketListing): string {
  if (listing.universalPrice) {
    return "∞";
  }

  if (listing.availableStock === null) {
    return "—";
  }

  return formatNumber(listing.availableStock);
}


function formatSeller(listing: MarketListing): string {
  if (listing.universalPrice) {
    return "Universal";
  }

  return listing.seller || "—";
}


function formatUpdatedDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}


export function renderListingPage(
  container: HTMLElement,
  options: ListingPageOptions,
): () => void {
  const {
    type,
    catalog,
    setStatus,
  } = options;

  const isBuying = type === "buying";

  let currentListings: MarketListing[] = [];

  container.innerHTML = `
    <section class="page-header">
      <div>
        <span class="page-eyebrow">
          ${isBuying ? "Spend grass blocks" : "Receive grass blocks"}
        </span>

        <h2>
          ${isBuying ? "Buying Items" : "Selling Items"}
        </h2>

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

    <section class="entry-card compact-entry-card">
      <div>
        <span class="page-eyebrow">
          Market listing
        </span>

        <h3>
          Add another ${isBuying ? "buying" : "selling"} offer
        </h3>

        <p>
          Include stock limits, seller information, shop coordinates,
          restock details, and notes.
        </p>
      </div>

      <button
        id="add-listing"
        class="primary-button"
        type="button"
      >
        Add ${isBuying ? "buying" : "selling"} listing
      </button>
    </section>

    <section class="results-card">
      <div class="table-toolbar">
        <input
          id="listing-filter"
          type="search"
          placeholder="Filter ${type} listings…"
          autocomplete="off"
        />

        <label class="checkbox-label">
          <input
            id="favorites-only"
            type="checkbox"
          />

          Favorites only
        </label>

        <select
          id="listing-sort"
          aria-label="Sort listings"
        >
          <option value="best">
            ${isBuying ? "Cheapest first" : "Highest return first"}
          </option>

          <option value="worst">
            ${isBuying ? "Most expensive first" : "Lowest return first"}
          </option>

          <option value="name">
            Name A–Z
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

          <tbody id="listing-table-body"></tbody>
        </table>
      </div>

      <div
        id="listing-empty"
        class="empty-state"
        hidden
      >
        No matching ${type} listings.
      </div>
    </section>
  `;

  const addButton =
    container.querySelector<HTMLButtonElement>(
      "#add-listing",
    )!;

  const filterInput =
    container.querySelector<HTMLInputElement>(
      "#listing-filter",
    )!;

  const favoritesOnly =
    container.querySelector<HTMLInputElement>(
      "#favorites-only",
    )!;

  const sortSelect =
    container.querySelector<HTMLSelectElement>(
      "#listing-sort",
    )!;

  const tableBody =
    container.querySelector<HTMLTableSectionElement>(
      "#listing-table-body",
    )!;

  const emptyState =
    container.querySelector<HTMLDivElement>(
      "#listing-empty",
    )!;

  const listingCount =
    container.querySelector<HTMLElement>(
      "#listing-count",
    )!;


  function submitListing(): void {
    openListingEditor({
      catalog,
      type,

      onSave: (listing) => {
        addListing(listing);

        setStatus(
          `Added ${type} listing for ${listing.item}`,
        );
      },
    });
  }


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


  function renderTable(): void {
    const query =
      filterInput.value.trim().toLowerCase();

    let visible = currentListings.filter(
      (listing) => {
        if (listing.type !== type) {
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
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      },
    );

    switch (sortSelect.value) {
      case "worst":
        visible.sort((a, b) =>
          isBuying
            ? b.pricePerItem - a.pricePerItem
            : a.pricePerItem - b.pricePerItem,
        );
        break;

      case "name":
        visible.sort((a, b) =>
          a.item.localeCompare(b.item),
        );
        break;

      case "recent":
        visible.sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        );
        break;

      case "favorites":
        visible.sort((a, b) => {
          if (a.favorite !== b.favorite) {
            return Number(b.favorite) - Number(a.favorite);
          }

          return isBuying
            ? a.pricePerItem - b.pricePerItem
            : b.pricePerItem - a.pricePerItem;
        });
        break;

      default:
        visible.sort((a, b) =>
          isBuying
            ? a.pricePerItem - b.pricePerItem
            : b.pricePerItem - a.pricePerItem,
        );
        break;
    }

    const listingTotal = currentListings.filter(
      (listing) => listing.type === type,
    ).length;

    listingCount.textContent = String(listingTotal);

    tableBody.innerHTML = visible
      .map(
        (listing) => `
          <tr data-id="${escapeHtml(listing.id)}">
            <td class="favorite-column">
              <button
                class="favorite-button"
                type="button"
                data-action="favorite"
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
                ${renderItemIdentity(listing)}
            </td>

            <td>
              ${formatNumber(listing.quantity)}
            </td>

            <td>
              ${formatNumber(listing.grassPrice)}g
            </td>

            <td>
              <span class="price-pill ${type}">
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
                type="button"
                data-action="menu"
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
      
    hydrateItemIcons(tableBody);

    const table =
      tableBody.closest<HTMLTableElement>("table")!;

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
                currentListings.find(
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


  addButton.addEventListener(
    "click",
    submitListing,
  );

  filterInput.addEventListener(
    "input",
    renderTable,
  );

  favoritesOnly.addEventListener(
    "change",
    renderTable,
  );

  sortSelect.addEventListener(
    "change",
    renderTable,
  );

  const unsubscribe =
    subscribeToListings((listings) => {
      currentListings = listings;
      renderTable();
    });

  return unsubscribe;
}