import {
    resolveItemName,
    searchItems,
    type ItemCatalog,
  } from "../data/itemCatalog.ts";
  
  import {
    parseListingExpression,
  } from "../parsers/listingParser.ts";
  
  import type {
    ListingType,
    MarketListing,
  } from "../types/listing.ts";

  import {
    openIconPickerDialog,
  } from "../components/IconPickerDialog.ts";
  
  import {
    getIconById,
    resolveItemIcon,
  } from "../services/itemIconService.ts";
  
  interface ListingEditorOptions {
    catalog: ItemCatalog;
    type: ListingType;
    existing?: MarketListing;
    initialItem?: string;
    onSave: (listing: MarketListing) => void;
  }
  
  function createId(): string {
    return (
      crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
  }
  
  function numberOrNull(value: string): number | null {
    const trimmed = value.trim();
  
    if (!trimmed) {
      return null;
    }
  
    const parsed = Number(trimmed);
  
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
  
    return parsed;
  }
  
  export function openListingEditor(
    options: ListingEditorOptions,
  ): void {
    const existing = options.existing;
    let selectedIconId =
      existing?.iconId ?? null;
  
    const backdrop = document.createElement("div");
    backdrop.className = "dialog-backdrop";
  
    const dialog = document.createElement("section");
    dialog.className = "dialog listing-editor-dialog";

    async function updateIconPreview():
  Promise<void> {
  iconPreview.replaceChildren("?");

  const itemName =
    itemInput.value.trim();

  const resolved =
    selectedIconId
      ? await getIconById(selectedIconId)
      : itemName
        ? await resolveItemIcon(itemName)
        : null;

  iconDescription.textContent =
    selectedIconId
      ? "A specific icon is selected for this listing."
      : "Automatically matched from the item name.";

  if (!resolved) {
    return;
  }

  const image = new Image();

  image.alt = "";
  image.draggable = false;
  image.src = resolved.url;

  image.addEventListener(
    "load",
    () => {
      iconPreview.replaceChildren(image);
    },
    { once: true },
  );
}
  
    dialog.innerHTML = `
      <header class="dialog-header">
        <div>
          <span class="page-eyebrow">
            ${existing ? "Modify market listing" : "Market listing"}
          </span>
  
          <h2>
            ${existing ? "Edit market listing" : "Create market listing"}
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
        <div class="listing-editor-icon-row">
          <div
            id="listing-editor-icon-preview"
            class="icon-picker-image"
          >
            ?
          </div>

          <div>
            <strong>Listing icon</strong>

            <p id="listing-editor-icon-description">
              Automatically matched from the item name.
            </p>
          </div>

          <button
            id="change-listing-icon"
            class="secondary-button"
            type="button"
          >
            Change icon
          </button>
        </div>
        <div class="editor-grid">
          <label>
            Item
  
            <input
              id="editor-item"
              type="text"
              autocomplete="off"
              value="${existing?.item ?? options.initialItem ?? ""}"
            />
  
            <div
              id="editor-item-suggestions"
              class="editor-suggestions"
              hidden
            ></div>
          </label>
  
          <label>
            Listing
  
            <input
              id="editor-expression"
              type="text"
              value="${
                existing
                  ? `${existing.quantity} for ${existing.grassPrice}g`
                  : ""
              }"
              placeholder="Example: 12 for 21g"
            />
          </label>
  
          <label>
            Seller
  
            <input
              id="editor-seller"
              type="text"
              value="${existing?.seller ?? ""}"
              placeholder="Optional"
            />
          </label>
  
          <label>
            Shop coordinates
  
            <input
              id="editor-coordinates"
              type="text"
              value="${existing?.shopCoordinates ?? ""}"
              placeholder="Optional"
            />
          </label>
  
          <label>
            Available stock
  
            <input
              id="editor-stock"
              type="number"
              min="0"
              step="1"
              value="${existing?.availableStock ?? ""}"
              placeholder="Not specified"
            />
          </label>
  
          <label>
            Maximum purchases
  
            <input
              id="editor-maximum"
              type="number"
              min="0"
              step="1"
              value="${existing?.maximumPurchases ?? ""}"
              placeholder="Not specified"
            />
          </label>
        </div>
  
        <label class="universal-price-option">
          <input
            id="editor-universal"
            type="checkbox"
            ${existing?.universalPrice ? "checked" : ""}
          />
  
          <span>
            <strong>Universal price</strong>
            <small>
              Treat this listing as unlimited and not tied to a seller.
            </small>
          </span>
        </label>
  
        <label>
          Restock information
  
          <input
            id="editor-restock"
            type="text"
            value="${existing?.restockDetails ?? ""}"
            placeholder="Optional restock schedule or details"
          />
        </label>
  
        <label>
          Notes
  
          <textarea
            id="editor-notes"
            rows="4"
            placeholder="Optional notes"
          >${existing?.notes ?? ""}</textarea>
        </label>
  
        <p id="editor-error" class="form-error" hidden></p>
      </div>
  
      <footer class="dialog-footer">
        <button
          class="secondary-button"
          id="editor-cancel"
          type="button"
        >
          Cancel
        </button>
  
        <button
          class="primary-button"
          id="editor-save"
          type="button"
        >
          ${existing ? "Save changes" : "Add listing"}
        </button>
      </footer>
    `;
  
    backdrop.append(dialog);
    document.body.append(backdrop);
  
    const itemInput =
      dialog.querySelector<HTMLInputElement>("#editor-item")!;
  
    const expressionInput =
      dialog.querySelector<HTMLInputElement>(
        "#editor-expression",
      )!;
  
    const sellerInput =
      dialog.querySelector<HTMLInputElement>("#editor-seller")!;
  
    const coordinatesInput =
      dialog.querySelector<HTMLInputElement>(
        "#editor-coordinates",
      )!;
  
    const stockInput =
      dialog.querySelector<HTMLInputElement>("#editor-stock")!;
  
    const maximumInput =
      dialog.querySelector<HTMLInputElement>("#editor-maximum")!;
  
    const universalInput =
      dialog.querySelector<HTMLInputElement>(
        "#editor-universal",
      )!;
  
    const restockInput =
      dialog.querySelector<HTMLInputElement>(
        "#editor-restock",
      )!;
  
    const notesInput =
      dialog.querySelector<HTMLTextAreaElement>("#editor-notes")!;
  
    const errorLabel =
      dialog.querySelector<HTMLParagraphElement>("#editor-error")!;
  
    const suggestionsBox =
      dialog.querySelector<HTMLDivElement>(
        "#editor-item-suggestions",
      )!;

    const iconPreview =
      dialog.querySelector<HTMLDivElement>(
        "#listing-editor-icon-preview",
      )!;
    
    const iconDescription =
      dialog.querySelector<HTMLElement>(
        "#listing-editor-icon-description",
      )!;
    
    const changeIconButton =
      dialog.querySelector<HTMLButtonElement>(
        "#change-listing-icon",
      )!;
  
    function close(): void {
      backdrop.remove();
    }
  
    function setUniversalState(): void {
      const disabled = universalInput.checked;
  
      sellerInput.disabled = disabled;
      stockInput.disabled = disabled;
      maximumInput.disabled = disabled;
  
      if (disabled) {
        sellerInput.value = "";
        stockInput.value = "";
        maximumInput.value = "";
      }
    }
  
    function showError(message: string): void {
      errorLabel.textContent = message;
      errorLabel.hidden = false;
    }
  
    function renderSuggestions(): void {
      const query = itemInput.value.trim();
  
      if (!query) {
        suggestionsBox.hidden = true;
        return;
      }
  
      const suggestions = searchItems(
        query,
        options.catalog,
        12,
      );
  
      if (suggestions.length === 0) {
        suggestionsBox.hidden = true;
        return;
      }
  
      suggestionsBox.innerHTML = suggestions
        .map(
          (item) => `
            <button
              type="button"
              data-item="${item}"
            >
              ${item}
            </button>
          `,
        )
        .join("");
  
      suggestionsBox.hidden = false;
  
      suggestionsBox
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((button) => {
          button.addEventListener("mousedown", (event) => {
            event.preventDefault();
  
            itemInput.value = button.dataset.item ?? "";
            suggestionsBox.hidden = true;
            expressionInput.focus();
          });
        });
    }
  
    function save(): void {
      errorLabel.hidden = true;
  
      const canonicalItem = resolveItemName(
        itemInput.value,
        options.catalog,
      );
  
      if (!canonicalItem) {
        const suggestion = searchItems(
          itemInput.value,
          options.catalog,
          1,
        )[0];
  
        showError(
          suggestion
            ? `Did you mean “${suggestion}”?`
            : "No matching Minecraft 1.19.2 item was found.",
        );
  
        return;
      }
  
      try {
        const parsed = parseListingExpression(
          expressionInput.value,
        );
  
        const now = new Date().toISOString();
  
        const listing: MarketListing = {
          id: existing?.id ?? createId(),
          type: existing?.type ?? options.type,
          item: canonicalItem,
          iconId: selectedIconId,
  
          quantity: parsed.quantity,
          grassPrice: parsed.grassPrice,
          pricePerItem: parsed.pricePerItem,
  
          favorite: existing?.favorite ?? false,
          universalPrice: universalInput.checked,
  
          seller: universalInput.checked
            ? ""
            : sellerInput.value.trim(),
  
          shopCoordinates: coordinatesInput.value.trim(),
  
          availableStock: universalInput.checked
            ? null
            : numberOrNull(stockInput.value),
  
          maximumPurchases: universalInput.checked
            ? null
            : numberOrNull(maximumInput.value),
  
          restockDetails: restockInput.value.trim(),
          notes: notesInput.value.trim(),
  
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
  
        options.onSave(listing);
        close();
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "The listing could not be saved.",
        );
      }
    }
  
    itemInput.addEventListener("input", renderSuggestions);
  
    itemInput.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        const suggestion = searchItems(
          itemInput.value,
          options.catalog,
          1,
        )[0];
  
        if (suggestion) {
          event.preventDefault();
          itemInput.value = suggestion;
          suggestionsBox.hidden = true;
          expressionInput.focus();
        }
      }
    });
  
    universalInput.addEventListener(
      "change",
      setUniversalState,
    );
  
    dialog
      .querySelector<HTMLButtonElement>(".dialog-close-button")!
      .addEventListener("click", close);
  
    dialog
      .querySelector<HTMLButtonElement>("#editor-cancel")!
      .addEventListener("click", close);
  
    dialog
      .querySelector<HTMLButtonElement>("#editor-save")!
      .addEventListener("click", save);
  
    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) {
        close();
      }
    });
  
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
      }
  
      if (
        event.key === "Enter" &&
        event.ctrlKey
      ) {
        save();
      }
    });

    changeIconButton.addEventListener(
      "click",
      () => {
        openIconPickerDialog({
          itemName:
            itemInput.value.trim() ||
            existing?.item ||
            "Unknown Item",
    
          selectedIconId,
    
          onSelect: (iconId) => {
            selectedIconId = iconId;
            void updateIconPreview();
          },
        });
      },
    );

    itemInput.addEventListener(
      "input",
      () => {
        renderSuggestions();
    
        if (selectedIconId === null) {
          void updateIconPreview();
        }
      },
    );
  
    setUniversalState();
    void updateIconPreview();
  
    window.setTimeout(() => {
      itemInput.focus();
      itemInput.select();
    });
  }