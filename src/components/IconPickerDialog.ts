import {
    getAllAvailableIcons,
    resolveItemIcon,
  } from "../services/itemIconService.ts";
  
  import type {
    ResolvedItemIcon,
  } from "../types/icon.ts";
  
  
  interface IconPickerDialogOptions {
    itemName: string;
    selectedIconId: string | null;
  
    onSelect: (
      iconId: string | null,
    ) => void;
  
    setStatus?: (
      message: string,
    ) => void;
  }
  
  
  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  
  
  export function openIconPickerDialog(
    options: IconPickerDialogOptions,
  ): void {
    let icons: ResolvedItemIcon[] = [];
    let selectedIconId =
      options.selectedIconId;
  
    const backdrop =
      document.createElement("div");
  
    backdrop.className =
      "dialog-backdrop";
  
    const dialog =
      document.createElement("section");
  
    dialog.className =
      "dialog icon-picker-dialog";
  
    dialog.innerHTML = `
      <header class="dialog-header">
        <div>
          <span class="page-eyebrow">
            Listing appearance
          </span>
  
          <h2>Choose an icon</h2>
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
        <button
          id="use-automatic-icon"
          class="automatic-icon-option"
          type="button"
        >
          <div
            id="automatic-icon-preview"
            class="icon-picker-image"
          >
            ?
          </div>
  
          <span>
            <strong>Use automatic icon</strong>
  
            <small>
              Match the icon using the item name
              “${escapeHtml(options.itemName)}”.
            </small>
          </span>
        </button>
  
        <input
          id="icon-picker-search"
          type="search"
          autocomplete="off"
          placeholder="Search available icons…"
        />
  
        <div
          id="icon-picker-grid"
          class="icon-picker-grid"
        ></div>
  
        <div
          id="icon-picker-empty"
          class="empty-state"
          hidden
        >
          No icons match this search.
        </div>
      </div>
  
      <footer class="dialog-footer">
        <button
          id="cancel-icon-picker"
          class="secondary-button"
          type="button"
        >
          Cancel
        </button>
  
        <button
          id="save-icon-picker"
          class="primary-button"
          type="button"
        >
          Use selected icon
        </button>
      </footer>
    `;
  
    backdrop.append(dialog);
    document.body.append(backdrop);
  
    const searchInput =
      dialog.querySelector<HTMLInputElement>(
        "#icon-picker-search",
      )!;
  
    const grid =
      dialog.querySelector<HTMLDivElement>(
        "#icon-picker-grid",
      )!;
  
    const emptyState =
      dialog.querySelector<HTMLDivElement>(
        "#icon-picker-empty",
      )!;
  
    const automaticButton =
      dialog.querySelector<HTMLButtonElement>(
        "#use-automatic-icon",
      )!;
  
    const automaticPreview =
      dialog.querySelector<HTMLDivElement>(
        "#automatic-icon-preview",
      )!;
  
    const saveButton =
      dialog.querySelector<HTMLButtonElement>(
        "#save-icon-picker",
      )!;
  
    const cancelButton =
      dialog.querySelector<HTMLButtonElement>(
        "#cancel-icon-picker",
      )!;
  
    const closeButton =
      dialog.querySelector<HTMLButtonElement>(
        ".dialog-close-button",
      )!;
  
  
    function close(): void {
      backdrop.remove();
    }
  
  
    function updateSelectionStyles(): void {
      automaticButton.classList.toggle(
        "selected",
        selectedIconId === null,
      );
  
      grid
        .querySelectorAll<HTMLElement>(
          "[data-icon-id]",
        )
        .forEach((element) => {
          element.classList.toggle(
            "selected",
            element.dataset.iconId ===
              selectedIconId,
          );
        });
    }
  
  
    function renderGrid(): void {
      const query =
        searchInput.value
          .trim()
          .toLowerCase();
  
      const visible = icons.filter(
        (icon) =>
          icon.name
            .toLowerCase()
            .includes(query),
      );
  
      grid.innerHTML = visible
        .map(
          (icon) => `
            <button
              class="icon-picker-option"
              type="button"
              data-icon-id="${escapeHtml(icon.id)}"
              title="${escapeHtml(icon.name)}"
            >
              <div class="icon-picker-image">
                <img
                  src="${escapeHtml(icon.url)}"
                  alt=""
                  draggable="false"
                  loading="lazy"
                />
  
                <span>?</span>
              </div>
  
              <strong>
                ${escapeHtml(icon.name)}
              </strong>
  
              ${
                icon.custom
                  ? `<small>Custom</small>`
                  : `<small>Built-in</small>`
              }
            </button>
          `,
        )
        .join("");
  
      grid.hidden =
        visible.length === 0;
  
      emptyState.hidden =
        visible.length !== 0;
  
      grid
        .querySelectorAll<HTMLImageElement>(
          "img",
        )
        .forEach((image) => {
          image.addEventListener(
            "error",
            () => {
              image.hidden = true;
            },
            { once: true },
          );
        });
  
      grid
        .querySelectorAll<HTMLButtonElement>(
          "[data-icon-id]",
        )
        .forEach((button) => {
          button.addEventListener(
            "click",
            () => {
              selectedIconId =
                button.dataset.iconId ?? null;
  
              updateSelectionStyles();
            },
          );
  
          button.addEventListener(
            "dblclick",
            () => {
              selectedIconId =
                button.dataset.iconId ?? null;
  
              options.onSelect(
                selectedIconId,
              );
  
              close();
            },
          );
        });
  
      updateSelectionStyles();
    }
  
  
    async function loadAutomaticPreview():
      Promise<void> {
      const resolved =
        await resolveItemIcon(
          options.itemName,
        );
  
      if (!resolved) {
        automaticPreview.textContent = "?";
        return;
      }
  
      const image = new Image();
  
      image.alt = "";
      image.draggable = false;
      image.src = resolved.url;
  
      image.addEventListener(
        "load",
        () => {
          automaticPreview.replaceChildren(
            image,
          );
        },
        { once: true },
      );
    }
  
  
    automaticButton.addEventListener(
      "click",
      () => {
        selectedIconId = null;
        updateSelectionStyles();
      },
    );
  
  
    saveButton.addEventListener(
      "click",
      () => {
        options.onSelect(
          selectedIconId,
        );
  
        options.setStatus?.(
          selectedIconId
            ? "Custom listing icon selected"
            : "Automatic listing icon selected",
        );
  
        close();
      },
    );
  
  
    cancelButton.addEventListener(
      "click",
      close,
    );
  
    closeButton.addEventListener(
      "click",
      close,
    );
  
  
    backdrop.addEventListener(
      "mousedown",
      (event) => {
        if (event.target === backdrop) {
          close();
        }
      },
    );
  
  
    dialog.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Escape") {
          close();
        }
  
        if (event.key === "Enter") {
          event.preventDefault();
  
          options.onSelect(
            selectedIconId,
          );
  
          close();
        }
      },
    );
  
  
    searchInput.addEventListener(
      "input",
      renderGrid,
    );
  
  
    void getAllAvailableIcons()
      .then((availableIcons) => {
        icons = availableIcons;
        renderGrid();
      });
  
    void loadAutomaticPreview();
  
    window.setTimeout(() => {
      searchInput.focus();
    });
  }