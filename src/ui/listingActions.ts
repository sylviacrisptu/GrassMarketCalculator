import type {
    ItemCatalog,
  } from "../data/itemCatalog.ts";
  
  import {
    deleteListing,
    duplicateListing,
    getListing,
    toggleListingFavorite,
    updateListing,
  } from "../state/appState.ts";
  
  import {
    showContextMenu,
  } from "./contextMenu.ts";
  
  import {
    openListingEditor,
  } from "./listingEditor.ts";
  
  interface ListingActionsOptions {
    listingId: string;
    x: number;
    y: number;
    catalog: ItemCatalog;
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
  
  async function copyText(
    text: string,
    status: string,
    setStatus: (message: string) => void,
  ): Promise<void> {
    await navigator.clipboard.writeText(text);
    setStatus(status);
  }
  
  function showNotes(
    title: string,
    notes: string,
  ): void {
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
  
    const dialog = document.createElement("section");
    dialog.className = "dialog notes-dialog";
  
    dialog.innerHTML = `
      <header class="dialog-header">
        <div>
          <span class="page-eyebrow">Listing notes</span>
          <h2>${title}</h2>
        </div>
  
        <button
          class="dialog-close-button"
          type="button"
        >
          ×
        </button>
      </header>
  
      <div class="dialog-body">
        <p class="notes-content">
          ${notes || "This listing has no notes."}
        </p>
      </div>
  
      <footer class="dialog-footer">
        <button class="primary-button" type="button">
          Close
        </button>
      </footer>
    `;
  
    backdrop.append(dialog);
    document.body.append(backdrop);
  
    function close(): void {
      backdrop.remove();
    }
  
    dialog
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((button) => {
        button.addEventListener("click", close);
      });
  
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) {
        close();
      }
    });
  }
  
  export function openListingActions(
    options: ListingActionsOptions,
  ): void {
    const listing = getListing(options.listingId);
  
    if (!listing) {
      return;
    }
  
    showContextMenu(options.x, options.y, [
      {
        icon: "✎",
        label: "Edit listing",
        action: () => {
          openListingEditor({
            catalog: options.catalog,
            type: listing.type,
            existing: listing,
            onSave: (updated) => {
              updateListing(updated);
              options.setStatus(
                `Updated listing for ${updated.item}`,
              );
            },
          });
        },
      },
      {
        icon: "$",
        label: "Send to Profit Calculator",
        action: () => {
          window.dispatchEvent(
            new CustomEvent(
              "gmc:navigate-profit",
              {
                detail: {
                  item: listing.item,
                },
              },
            ),
          );
      
          options.setStatus(
            `Sent ${listing.item} to Profit Calculator`,
          );
        },
      },
      {
        icon: "⧉",
        label: "Duplicate listing",
        action: () => {
          const duplicate = duplicateListing(listing.id);
  
          if (duplicate) {
            options.setStatus(
              `Duplicated listing for ${duplicate.item}`,
            );
          }
        },
      },
      {
        icon: listing.favorite ? "☆" : "★",
        label: listing.favorite
          ? "Remove favorite"
          : "Mark as favorite",
        action: () => {
          toggleListingFavorite(listing.id);
        },
      },
      {
        separator: true,
      },
      {
        icon: "⧉",
        label: "Copy item name",
        action: () => {
          void copyText(
            listing.item,
            `Copied ${listing.item}`,
            options.setStatus,
          );
        },
      },
      {
        icon: "¤",
        label: "Copy listing",
        action: () => {
          void copyText(
            `${listing.item}: ${formatNumber(
              listing.quantity,
            )} for ${formatNumber(listing.grassPrice)}g`,
            `Copied listing for ${listing.item}`,
            options.setStatus,
          );
        },
      },
      {
        icon: "☰",
        label: "View notes",
        action: () => {
          showNotes(listing.item, listing.notes);
        },
      },
      {
        separator: true,
      },
      {
        icon: "⌫",
        label: "Delete listing",
        danger: true,
        action: () => {
          const confirmed = window.confirm(
            `Delete the ${listing.type} listing for ${listing.item}?`,
          );
  
          if (!confirmed) {
            return;
          }
  
          deleteListing(listing.id);
          options.setStatus(
            `Deleted listing for ${listing.item}`,
          );
        },
      },
    ]);
  }