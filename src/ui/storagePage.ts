import {
    type ItemCatalog,
  } from "../data/itemCatalog.ts";
  
  import {
    hydrateItemIcons,
  } from "../services/itemIconService.ts";
  
  import {
    addStorageItem,
    adjustStorageQuantity,
    deleteStorageItem,
    getStorageItem,
    setStorageQuantity,
    subscribeToStorage,
    toggleStorageFavorite,
    updateStorageItem,
  } from "../state/storageState.ts";
  
  import {
    addListing,
  } from "../state/appState.ts";
  
  import type {
    ListingType,
  } from "../types/listing.ts";
  
  import type {
    StorageItem,
  } from "../types/storage.ts";
  
  import {
    createQuantityBreakdown,
    parseQuantityExpression,
  } from "../utils/quantityParser.ts";
  
  import {
    showContextMenu,
  } from "./contextMenu.ts";
  
  import {
    openListingEditor,
  } from "./listingEditor.ts";
  
  import {
    openStorageEditor,
  } from "./storageEditor.ts";
  
  interface StoragePageOptions {
    catalog: ItemCatalog;
    setStatus: (message: string) => void;
  }
  
  type DisplayMode =
    | "items"
    | "stacks"
    | "single-chests"
    | "double-chests"
    | "mixed";
  
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
  
  function formatMixed(
    quantity: number,
  ): string {
    const result =
      createQuantityBreakdown(quantity);
  
    const parts: string[] = [];
  
    if (result.doubleChestsWhole > 0) {
      parts.push(
        `${result.doubleChestsWhole}dc`,
      );
  
      const remainingAfterDouble =
        quantity -
        result.doubleChestsWhole *
          54 *
          64;
  
      const stacks = Math.floor(
        remainingAfterDouble / 64,
      );
  
      const items =
        remainingAfterDouble -
        stacks * 64;
  
      if (stacks > 0) {
        parts.push(`${stacks}s`);
      }
  
      if (items > 0) {
        parts.push(
          `${formatNumber(items)} items`,
        );
      }
    } else if (result.stacksWhole > 0) {
      parts.push(
        `${result.stacksWhole} stacks`,
      );
  
      if (result.remainderItems > 0) {
        parts.push(
          `${formatNumber(
            result.remainderItems,
          )} items`,
        );
      }
    } else {
      parts.push(
        `${formatNumber(quantity)} items`,
      );
    }
  
    return parts.join(" + ");
  }
  
  function formatQuantity(
    quantity: number,
    mode: DisplayMode,
  ): string {
    const result =
      createQuantityBreakdown(quantity);
  
    switch (mode) {
      case "stacks":
        return `${formatNumber(
          result.stacks,
        )} stacks`;
  
      case "single-chests":
        return `${formatNumber(
          result.singleChests,
        )} single chests`;
  
      case "double-chests":
        return `${formatNumber(
          result.doubleChests,
        )} double chests`;
  
      case "mixed":
        return formatMixed(quantity);
  
      default:
        return `${formatNumber(
          quantity,
        )} items`;
    }
  }
  
  export function renderStoragePage(
    container: HTMLElement,
    options: StoragePageOptions,
  ): () => void {
    let items: StorageItem[] = [];
  
    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="page-eyebrow">
            Owned inventory
          </span>
  
          <h2>Storage</h2>
  
          <p>
            Track owned items and quantities using
            stacks, chests, or math expressions.
          </p>
        </div>
  
        <div class="page-stat">
          <strong id="storage-count">0</strong>
          <span>stored item types</span>
        </div>
      </section>
  
      <section class="entry-card compact-entry-card">
        <div>
          <span class="page-eyebrow">
            Storage item
          </span>
  
          <h3>Add an owned item</h3>
  
          <p>
            Quantities support expressions such as
            8 stacks, 1dc + 5s, or 30 * 40.
          </p>
        </div>
  
        <button
          id="add-storage-item"
          class="primary-button"
          type="button"
        >
          Add storage item
        </button>
      </section>
  
      <section class="results-card">
        <div class="table-toolbar">
          <input
            id="storage-search"
            type="search"
            autocomplete="off"
            placeholder="Search storage…"
          />
  
          <label class="checkbox-label">
            <input
              id="storage-favorites-only"
              type="checkbox"
            />
  
            Favorites only
          </label>
  
          <select
            id="storage-display-mode"
            aria-label="Quantity display mode"
          >
            <option value="items">
              Display as items
            </option>
  
            <option value="stacks">
              Display as stacks
            </option>
  
            <option value="single-chests">
              Display as single chests
            </option>
  
            <option value="double-chests">
              Display as double chests
            </option>
  
            <option value="mixed">
              Display compact form
            </option>
          </select>
  
          <select
            id="storage-sort"
            aria-label="Sort storage"
          >
            <option value="name">
              Name A–Z
            </option>
  
            <option value="quantity-high">
              Highest quantity
            </option>
  
            <option value="quantity-low">
              Lowest quantity
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
          <table class="listing-table storage-table">
            <thead>
              <tr>
                <th class="favorite-column">★</th>
                <th>Item</th>
                <th>Quantity owned</th>
                <th class="storage-adjust-column">
                  Adjust
                </th>
                <th class="actions-column"></th>
              </tr>
            </thead>
  
            <tbody id="storage-table-body"></tbody>
          </table>
        </div>
  
        <div
          id="storage-empty"
          class="empty-state"
          hidden
        >
          No storage items match these filters.
        </div>
  
        <p class="storage-help">
          Tip: click a quantity to edit it.<br>
          Hold &ensp;<b>Shift</b>&ensp; while using + or − to change by one stack.<br>
          Hold &ensp;<b>Ctrl</b>&ensp; while using + or - to change by 10 items.<br>
          Hold &ensp;<b>Ctrl + Shift</b>&ensp; while using + or - to change by 10 stacks.
        </p>
      </section>
    `;
  
    const addButton =
      container.querySelector<HTMLButtonElement>(
        "#add-storage-item",
      )!;
  
    const searchInput =
      container.querySelector<HTMLInputElement>(
        "#storage-search",
      )!;
  
    const favoritesOnly =
      container.querySelector<HTMLInputElement>(
        "#storage-favorites-only",
      )!;
  
    const displayModeSelect =
      container.querySelector<HTMLSelectElement>(
        "#storage-display-mode",
      )!;
  
    const sortSelect =
      container.querySelector<HTMLSelectElement>(
        "#storage-sort",
      )!;
  
    const tableBody =
      container.querySelector<HTMLTableSectionElement>(
        "#storage-table-body",
      )!;
  
    const emptyState =
      container.querySelector<HTMLDivElement>(
        "#storage-empty",
      )!;
  
    const countLabel =
      container.querySelector<HTMLElement>(
        "#storage-count",
      )!;
  
    function openNewListing(
      item: StorageItem,
      type: ListingType,
    ): void {
      openListingEditor({
        catalog: options.catalog,
        type,
        initialItem: item.item,
  
        onSave: (listing) => {
          addListing(listing);
  
          options.setStatus(
            `Added ${type} listing for ${listing.item}`,
          );
        },
      });
    }
  
    function openActions(
      item: StorageItem,
      x: number,
      y: number,
    ): void {
      showContextMenu(x, y, [
        {
          icon: "✎",
          label: "Edit storage item",
  
          action: () => {
            openStorageEditor({
              catalog: options.catalog,
              existing: item,
  
              onSave: (value) => {
                updateStorageItem({
                  ...item,
                  ...value,
                });
  
                options.setStatus(
                  `Updated ${value.item}`,
                );
              },
            });
          },
        },
  
        {
          icon: "¤",
          label:
            "Send to Profit Calculator",
  
          action: () => {
            window.dispatchEvent(
              new CustomEvent(
                "gmc:navigate-profit",
                {
                  detail: {
                    item: item.item,
                  },
                },
              ),
            );
          },
        },
  
        {
          separator: true,
        },
  
        {
          icon: "↓",
          label: "Create buying listing",
  
          action: () => {
            openNewListing(
              item,
              "buying",
            );
          },
        },
  
        {
          icon: "↑",
          label: "Create selling listing",
  
          action: () => {
            openNewListing(
              item,
              "selling",
            );
          },
        },
  
        {
          icon: "⧉",
          label: "Copy item name",
  
          action: () => {
            void navigator.clipboard
              .writeText(item.item);
  
            options.setStatus(
              `Copied ${item.item}`,
            );
          },
        },
  
        {
          separator: true,
        },
  
        {
          icon: "⌫",
          label: "Delete storage item",
          danger: true,
  
          action: () => {
            const confirmed =
              window.confirm(
                `Delete ${item.item} from Storage?`,
              );
  
            if (!confirmed) {
              return;
            }
  
            deleteStorageItem(item.id);
  
            options.setStatus(
              `Removed ${item.item} from Storage`,
            );
          },
        },
      ]);
    }
  
    function getModifierAmount(
        event: MouseEvent | PointerEvent,
      ): number {
        if (event.ctrlKey && event.shiftKey) {
          return 640;
        }
      
        if (event.shiftKey) {
          return 64;
        }
      
        if (event.ctrlKey) {
          return 10;
        }
      
        return 1;
      }

    function render(): void {
      const query =
        searchInput.value
          .trim()
          .toLowerCase();
  
      const mode = displayModeSelect.value as DisplayMode;
  
      let visible = items.filter(
        (item) => {
          if (
            favoritesOnly.checked &&
            !item.favorite
          ) {
            return false;
          }
  
          return [
            item.item,
            item.notes,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query);
        },
      );
  
      switch (sortSelect.value) {
        case "quantity-high":
          visible.sort(
            (a, b) =>
              b.quantity - a.quantity,
          );
          break;
  
        case "quantity-low":
          visible.sort(
            (a, b) =>
              a.quantity - b.quantity,
          );
          break;
  
        case "recent":
          visible.sort(
            (a, b) =>
              b.updatedAt.localeCompare(
                a.updatedAt,
              ),
          );
          break;
  
        case "favorites":
          visible.sort((a, b) => {
            if (
              a.favorite !== b.favorite
            ) {
              return (
                Number(b.favorite) -
                Number(a.favorite)
              );
            }
  
            return a.item.localeCompare(
              b.item,
            );
          });
          break;
  
        default:
          visible.sort(
            (a, b) =>
              a.item.localeCompare(
                b.item,
              ),
          );
          break;
      }
  
      countLabel.textContent =
        String(items.length);
  
      tableBody.innerHTML = visible
        .map(
          (item) => `
            <tr data-id="${escapeHtml(item.id)}">
              <td class="favorite-column">
                <button
                  class="favorite-button"
                  type="button"
                  data-action="favorite"
                  aria-label="Toggle favorite"
                >
                  ${
                    item.favorite
                      ? "★"
                      : "☆"
                  }
                </button>
              </td>
  
              <td>
                <div class="item-identity">
                  <div
                    class="item-icon"
                    data-item="${escapeHtml(item.item)}"
                    data-icon-id="${escapeHtml(
                      item.iconId ?? "",
                    )}"
                    aria-hidden="true"
                  >
                    ?
                  </div>
  
                  <div class="item-identity-copy">
                    <strong class="item-identity-name">
                      ${escapeHtml(item.item)}
                    </strong>
  
                    ${
                      item.notes
                        ? `
                          <span class="item-identity-detail">
                            ${escapeHtml(item.notes)}
                          </span>
                        `
                        : ""
                    }
                  </div>
                </div>
              </td>
  
              <td>
                <input
                  class="storage-quantity-input"
                  type="text"
                  data-quantity-input
                  value="${escapeHtml(
                    formatQuantity(
                      item.quantity,
                      mode,
                    ),
                  )}"
                  aria-label="Quantity owned for ${escapeHtml(item.item)}"
                />
              </td>
  
              <td class="storage-adjust-column">
                <div class="storage-adjust-buttons">
                  <button
                    type="button"
                    data-action="decrease"
                    title="Decrease quantity. Ctrl: 10, Shift: 64, Ctrl+Shift: 640."
                  >
                    −1
                  </button>
  
                  <button
                    type="button"
                    data-action="increase"
                    title="Increase quantity. Ctrl: 10, Shift: 64, Ctrl+Shift: 640."
                  >
                    +1
                  </button>
                </div>
              </td>
  
              <td class="actions-column">
                <button
                  class="storage-remove-button"
                  type="button"
                  data-action="remove"
                  aria-label="Remove ${escapeHtml(item.item)}"
                  title="Remove from Storage"
                >
                  ×
                </button>
              </td>
            </tr>
          `,
        )
        .join("");
  
      void hydrateItemIcons(tableBody);
  
      const table =
        tableBody.closest<HTMLTableElement>(
          "table",
        )!;
  
      table.hidden =
        visible.length === 0;
  
      emptyState.hidden =
        visible.length !== 0;
  
      tableBody
        .querySelectorAll<HTMLTableRowElement>(
          "tr[data-id]",
        )
        .forEach((row) => {
          row.addEventListener(
            "contextmenu",
            (event) => {
              event.preventDefault();
  
              const item =
                getStorageItem(
                  row.dataset.id ?? "",
                );
  
              if (!item) {
                return;
              }
  
              openActions(
                item,
                event.clientX,
                event.clientY,
              );
            },
          );
        });
  
      tableBody
        .querySelectorAll<HTMLInputElement>(
          "[data-quantity-input]",
        )
        .forEach((input) => {
          function commitInput(): void {
            const row =
              input.closest<HTMLTableRowElement>(
                "tr[data-id]",
              );
  
            const id = row?.dataset.id;
  
            if (!id) {
              return;
            }
  
            try {
              const quantity =
                parseQuantityExpression(
                  input.value,
                );
  
              setStorageQuantity(
                id,
                quantity,
              );
  
              options.setStatus(
                "Storage quantity updated",
              );
            } catch {
              const item =
                getStorageItem(id);
  
              if (item) {
                input.value =
                  formatQuantity(
                    item.quantity,
                    mode,
                  );
              }
  
              options.setStatus(
                "Invalid storage quantity",
              );
            }
          }
  
          input.addEventListener(
            "focus",
            () => {
              const row =
                input.closest<HTMLTableRowElement>(
                  "tr[data-id]",
                );
  
              const item =
                getStorageItem(
                  row?.dataset.id ?? "",
                );
  
              if (item) {
                input.value =
                  formatNumber(
                    item.quantity,
                  );
  
                input.select();
              }
            },
          );
  
          input.addEventListener(
            "keydown",
            (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                input.blur();
              }
  
              if (event.key === "Escape") {
                const row =
                  input.closest<HTMLTableRowElement>(
                    "tr[data-id]",
                  );
  
                const item =
                  getStorageItem(
                    row?.dataset.id ?? "",
                  );
  
                if (item) {
                  input.value =
                    formatQuantity(
                      item.quantity,
                      mode,
                    );
                }
  
                input.blur();
              }
            },
          );
  
          input.addEventListener(
            "blur",
            commitInput,
          );
        });
  
      tableBody
        .querySelectorAll<HTMLButtonElement>(
          "button[data-action]",
        )
        .forEach((button) => {
          const buttonAction =
            button.dataset.action;
          
          if (
            buttonAction === "increase" ||
            buttonAction === "decrease"
          ) {
            const updateLabel = (
              event: MouseEvent | PointerEvent,
            ): void => {
              const amount =
                getModifierAmount(event);
          
              button.textContent =
                buttonAction === "increase"
                  ? `+${amount}`
                  : `−${amount}`;
            };
          
            button.addEventListener(
              "pointerenter",
              updateLabel,
            );
          
            button.addEventListener(
              "pointermove",
              updateLabel,
            );
          
            button.addEventListener(
              "pointerdown",
              updateLabel,
            );
          
            button.addEventListener(
              "pointerleave",
              () => {
                button.textContent =
                  buttonAction === "increase"
                    ? "+1"
                    : "−1";
              },
            );
          }
          button.addEventListener(
            "click",
            (event) => {
              const row =
                button.closest<HTMLTableRowElement>(
                  "tr[data-id]",
                );
  
              const id = row?.dataset.id;
  
              if (!id) {
                return;
              }
  
              const item =
                getStorageItem(id);
  
              if (!item) {
                return;
              }
  
              const action =
                button.dataset.action;
  
              if (action === "favorite") {
                toggleStorageFavorite(id);
                return;
              }
  
              if (
                action === "increase" ||
                action === "decrease"
              ) {
                const amount =
                    getModifierAmount(event);
                
                adjustStorageQuantity(
                  id,
                  action === "increase"
                    ? amount
                    : -amount,
                );
  
                return;
              }
  
              if (action === "remove") {
                deleteStorageItem(id);
  
                options.setStatus(
                  `Removed ${item.item} from Storage`,
                );
              }
            },
          );
        });
    }
  
    addButton.addEventListener(
      "click",
      () => {
        openStorageEditor({
          catalog: options.catalog,
  
          onSave: (value) => {
            addStorageItem(value);
  
            options.setStatus(
              `Added ${value.item} to Storage`,
            );
          },
        });
      },
    );
  
    searchInput.addEventListener(
      "input",
      render,
    );
  
    favoritesOnly.addEventListener(
      "change",
      render,
    );
  
    displayModeSelect.addEventListener(
      "change",
      render,
    );
  
    sortSelect.addEventListener(
      "change",
      render,
    );

    const unsubscribe =
        subscribeToStorage(
            (nextItems) => {
                items = nextItems;
                render();
            },
        );
    
    return () => {
        unsubscribe();
      };
  }