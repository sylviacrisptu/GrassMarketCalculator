import {
    resolveItemName,
    searchItems,
    type ItemCatalog,
  } from "../data/itemCatalog.ts";
  
  import {
    getIconById,
    resolveItemIcon,
  } from "../services/itemIconService.ts";
  
  import type {
    StorageItem,
  } from "../types/storage.ts";
  
  import {
    parseQuantityExpression,
  } from "../utils/quantityParser.ts";
  
  import {
    openIconPickerDialog,
  } from "../components/IconPickerDialog.ts";
  
  interface StorageEditorOptions {
    catalog: ItemCatalog;
    existing?: StorageItem;
    initialItem?: string;
  
    onSave: (value: {
      item: string;
      iconId: string | null;
      quantity: number;
      favorite: boolean;
      notes: string;
    }) => void;
  }
  
  export function openStorageEditor(
    options: StorageEditorOptions,
  ): void {
    const existing = options.existing;
  
    let selectedIconId =
      existing?.iconId ?? null;
  
    const backdrop =
      document.createElement("div");
  
    backdrop.className =
      "dialog-backdrop";
  
    const dialog =
      document.createElement("section");
  
    dialog.className =
      "dialog storage-editor-dialog";
  
    dialog.innerHTML = `
      <header class="dialog-header">
        <div>
          <span class="page-eyebrow">
            Owned inventory
          </span>
  
          <h2>
            ${
              existing
                ? "Edit storage item"
                : "Add storage item"
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
        <div class="listing-editor-icon-row">
          <div
            id="storage-icon-preview"
            class="icon-picker-image"
          >
            ?
          </div>
  
          <div>
            <strong>Storage icon</strong>
  
            <p id="storage-icon-description">
              Automatically matched from the item name.
            </p>
          </div>
  
          <button
            id="change-storage-icon"
            class="secondary-button"
            type="button"
          >
            Change icon
          </button>
        </div>
  
        <label class="storage-editor-item-label">
          Item
  
          <input
            id="storage-editor-item"
            type="text"
            autocomplete="off"
            value="${
              existing?.item ??
              options.initialItem ??
              ""
            }"
            placeholder="Search Minecraft items…"
          />
  
          <div
            id="storage-editor-suggestions"
            class="editor-suggestions"
            hidden
          ></div>
        </label>
  
        <label>
          Quantity owned
  
          <input
            id="storage-editor-quantity"
            type="text"
            autocomplete="off"
            value="${
              existing?.quantity ?? ""
            }"
            placeholder="Example: 1dc + 5s + 12"
          />
        </label>
  
        <label>
          Notes
  
          <textarea
            id="storage-editor-notes"
            rows="4"
            placeholder="Optional notes"
          >${existing?.notes ?? ""}</textarea>
        </label>
  
        <label class="checkbox-label">
          <input
            id="storage-editor-favorite"
            type="checkbox"
            ${
              existing?.favorite
                ? "checked"
                : ""
            }
          />
  
          Favorite item
        </label>
  
        <p
          id="storage-editor-error"
          class="form-error"
          hidden
        ></p>
      </div>
  
      <footer class="dialog-footer">
        <button
          id="cancel-storage-editor"
          class="secondary-button"
          type="button"
        >
          Cancel
        </button>
  
        <button
          id="save-storage-editor"
          class="primary-button"
          type="button"
        >
          ${
            existing
              ? "Save changes"
              : "Add item"
          }
        </button>
      </footer>
    `;
  
    backdrop.append(dialog);
    document.body.append(backdrop);
  
    const itemInput =
      dialog.querySelector<HTMLInputElement>(
        "#storage-editor-item",
      )!;
  
    const quantityInput =
      dialog.querySelector<HTMLInputElement>(
        "#storage-editor-quantity",
      )!;
  
    const notesInput =
      dialog.querySelector<HTMLTextAreaElement>(
        "#storage-editor-notes",
      )!;
  
    const favoriteInput =
      dialog.querySelector<HTMLInputElement>(
        "#storage-editor-favorite",
      )!;
  
    const suggestionBox =
      dialog.querySelector<HTMLDivElement>(
        "#storage-editor-suggestions",
      )!;
  
    const iconPreview =
      dialog.querySelector<HTMLDivElement>(
        "#storage-icon-preview",
      )!;
  
    const iconDescription =
      dialog.querySelector<HTMLElement>(
        "#storage-icon-description",
      )!;
  
    const changeIconButton =
      dialog.querySelector<HTMLButtonElement>(
        "#change-storage-icon",
      )!;
  
    const errorLabel =
      dialog.querySelector<HTMLParagraphElement>(
        "#storage-editor-error",
      )!;
  
    function close(): void {
      backdrop.remove();
    }
  
    function showError(
      message: string,
    ): void {
      errorLabel.textContent = message;
      errorLabel.hidden = false;
    }
  
    function renderSuggestions(): void {
      const query = itemInput.value.trim();
  
      if (!query) {
        suggestionBox.hidden = true;
        return;
      }
  
      const suggestions = searchItems(
        query,
        options.catalog,
        12,
      );
  
      suggestionBox.innerHTML = suggestions
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
  
      suggestionBox.hidden =
        suggestions.length === 0;
  
      suggestionBox
        .querySelectorAll<HTMLButtonElement>(
          "button",
        )
        .forEach((button) => {
          button.addEventListener(
            "mousedown",
            (event) => {
              event.preventDefault();
  
              itemInput.value =
                button.dataset.item ?? "";
  
              suggestionBox.hidden = true;
  
              if (selectedIconId === null) {
                void updateIconPreview();
              }
  
              quantityInput.focus();
            },
          );
        });
    }
  
    async function updateIconPreview():
      Promise<void> {
      iconPreview.replaceChildren("?");
  
      const itemName =
        itemInput.value.trim();
  
      const resolved =
        selectedIconId
          ? await getIconById(
              selectedIconId,
            )
          : itemName
            ? await resolveItemIcon(
                itemName,
              )
            : null;
  
      iconDescription.textContent =
        selectedIconId
          ? "A specific icon is selected."
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
          iconPreview.replaceChildren(
            image,
          );
        },
        { once: true },
      );
    }
  
    function save(): void {
      errorLabel.hidden = true;
  
      const canonicalItem =
        resolveItemName(
          itemInput.value,
          options.catalog,
        );
  
      if (!canonicalItem) {
        showError(
          "Choose a valid Minecraft item.",
        );
  
        return;
      }
  
      try {
        const quantity =
          parseQuantityExpression(
            quantityInput.value,
          );
  
        options.onSave({
          item: canonicalItem,
          iconId: selectedIconId,
          quantity,
          favorite:
            favoriteInput.checked,
          notes:
            notesInput.value.trim(),
        });
  
        close();
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "The item could not be saved.",
        );
      }
    }
  
    itemInput.addEventListener(
      "input",
      () => {
        renderSuggestions();
  
        if (selectedIconId === null) {
          void updateIconPreview();
        }
      },
    );
  
    itemInput.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Tab") {
          const suggestion = searchItems(
            itemInput.value,
            options.catalog,
            1,
          )[0];
  
          if (suggestion) {
            event.preventDefault();
  
            itemInput.value =
              suggestion;
  
            suggestionBox.hidden = true;
  
            if (
              selectedIconId === null
            ) {
              void updateIconPreview();
            }
  
            quantityInput.focus();
          }
        }
      },
    );
  
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
  
    dialog
      .querySelector<HTMLButtonElement>(
        "#save-storage-editor",
      )!
      .addEventListener("click", save);
  
    dialog
      .querySelector<HTMLButtonElement>(
        "#cancel-storage-editor",
      )!
      .addEventListener("click", close);
  
    dialog
      .querySelector<HTMLButtonElement>(
        ".dialog-close-button",
      )!
      .addEventListener("click", close);
  
    quantityInput.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          save();
        }
      },
    );
  
    backdrop.addEventListener(
      "mousedown",
      (event) => {
        if (event.target === backdrop) {
          close();
        }
      },
    );
  
    void updateIconPreview();
  
    window.setTimeout(() => {
      itemInput.focus();
      itemInput.select();
    });
  }