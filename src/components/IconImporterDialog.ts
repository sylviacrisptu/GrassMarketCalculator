import {
    addCustomIcon,
  } from "../services/itemIconService.ts";
  
  import type {
    CustomIconEntry,
  } from "../types/icon.ts";
  
  import {
    CropCanvas,
  } from "./CropCanvas.ts";
  
  
  interface IconImporterDialogOptions {
    initialFile?: Blob;
    onSaved?: (
      icon: CustomIconEntry,
    ) => void | Promise<void>;
    setStatus?: (
      message: string,
    ) => void;
  }
  
  
  function createIconId(
    name: string,
  ): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
  
  
  function loadImageFromBlob(
    blob: Blob,
  ): Promise<HTMLImageElement> {
    const sourceUrl =
      URL.createObjectURL(blob);
  
    return new Promise(
      (resolve, reject) => {
        const image = new Image();
  
        image.addEventListener(
          "load",
          () => {
            URL.revokeObjectURL(
              sourceUrl,
            );
  
            resolve(image);
          },
          { once: true },
        );
  
        image.addEventListener(
          "error",
          () => {
            URL.revokeObjectURL(
              sourceUrl,
            );
  
            reject(
              new Error(
                "The selected image could not be loaded.",
              ),
            );
          },
          { once: true },
        );
  
        image.src = sourceUrl;
      },
    );
  }
  
  
  export function openIconImporterDialog(
    options: IconImporterDialogOptions = {},
  ): void {
    let selectedFile:
      Blob | null =
        options.initialFile ?? null;
  
    let cropCanvasController:
      CropCanvas | null = null;
  
    const backdrop =
      document.createElement("div");
  
    backdrop.className =
      "dialog-backdrop";
  
    const dialog =
      document.createElement("section");
  
    dialog.className =
      "dialog icon-importer-dialog";
  
    dialog.innerHTML = `
      <header class="dialog-header">
        <div>
          <span class="page-eyebrow">
            Custom icon
          </span>
  
          <h2>Import icon</h2>
        </div>
  
        <button
          class="dialog-close-button"
          type="button"
          aria-label="Close"
        >
          ×
        </button>
      </header>
  
      <div class="dialog-body icon-importer-body">
        <div
          id="icon-import-dropzone"
          class="icon-dialog-dropzone"
          tabindex="0"
        >
          <div
            id="icon-import-empty"
            class="icon-dialog-empty"
          >
            <strong>
              Drop, paste, or click to choose an image
            </strong>
  
            <span>
              PNG, JPEG, and WebP are supported.
            </span>
          </div>
  
          <canvas
            id="icon-crop-canvas"
            width="560"
            height="420"
            hidden
          ></canvas>
        </div>
  
        <div
          id="crop-help"
          class="crop-help"
          hidden
        >
          Drag inside the crop box to move it.
          Drag a corner to resize it.
        </div>

        <label
          id="crop-grid-option"
          class="checkbox-label crop-grid-option"
          hidden
        >
          <input
            id="show-crop-grid"
            type="checkbox"
            checked
          />

          Show rule-of-thirds grid
        </label>
  
        <label>
          Custom icon name
  
          <input
            id="custom-icon-name"
            type="text"
            placeholder="Example: Special Map"
          />
        </label>
  
        <p
          id="icon-import-error"
          class="form-error"
          hidden
        ></p>
  
        <input
          id="icon-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
        />
      </div>
  
      <footer class="dialog-footer">
        <button
          id="reset-icon-crop"
          class="secondary-button"
          type="button"
          disabled
        >
          Reset crop
        </button>
  
        <span class="dialog-footer-spacer"></span>
  
        <button
          id="cancel-icon-import"
          class="secondary-button"
          type="button"
        >
          Cancel
        </button>
  
        <button
          id="save-custom-icon"
          class="primary-button"
          type="button"
          disabled
        >
          Save icon
        </button>
      </footer>
    `;
  
    backdrop.append(dialog);
    document.body.append(backdrop);
  
    const dropzone =
      dialog.querySelector<HTMLDivElement>(
        "#icon-import-dropzone",
      )!;
  
    const emptyState =
      dialog.querySelector<HTMLDivElement>(
        "#icon-import-empty",
      )!;
  
    const cropCanvas =
      dialog.querySelector<HTMLCanvasElement>(
        "#icon-crop-canvas",
      )!;
  
    const cropHelp =
      dialog.querySelector<HTMLDivElement>(
        "#crop-help",
      )!;
  
    const nameInput =
      dialog.querySelector<HTMLInputElement>(
        "#custom-icon-name",
      )!;
  
    const fileInput =
      dialog.querySelector<HTMLInputElement>(
        "#icon-file-input",
      )!;
  
    const resetButton =
      dialog.querySelector<HTMLButtonElement>(
        "#reset-icon-crop",
      )!;
  
    const saveButton =
      dialog.querySelector<HTMLButtonElement>(
        "#save-custom-icon",
      )!;
  
    const cancelButton =
      dialog.querySelector<HTMLButtonElement>(
        "#cancel-icon-import",
      )!;
  
    const closeButton =
      dialog.querySelector<HTMLButtonElement>(
        ".dialog-close-button",
      )!;
  
    const errorLabel =
      dialog.querySelector<HTMLParagraphElement>(
        "#icon-import-error",
      )!;

    const gridOption =
      dialog.querySelector<HTMLElement>(
        "#crop-grid-option",
      )!;

    const gridCheckbox =
      dialog.querySelector<HTMLInputElement>(
        "#show-crop-grid",
      )!;
  
  
    function showError(
      message: string,
    ): void {
      errorLabel.textContent = message;
      errorLabel.hidden = false;
    }
  
  
    function clearError(): void {
      errorLabel.textContent = "";
      errorLabel.hidden = true;
    }
  
  
    function close(): void {
      cropCanvasController?.destroy();
      cropCanvasController = null;
  
      document.removeEventListener(
        "paste",
        handlePaste,
      );
  
      backdrop.remove();
    }
  
  
    async function loadSelectedFile(
      file: Blob,
    ): Promise<void> {
      clearError();
  
      if (
        !file.type.startsWith(
          "image/",
        )
      ) {
        showError(
          "Please select an image file.",
        );
  
        return;
      }
  
      try {
        selectedFile = file;
  
        const image =
          await loadImageFromBlob(file);
  
        cropCanvasController?.destroy();
  
        cropCanvasController =
          new CropCanvas({
            canvas: cropCanvas,
            image,
          });
  
        emptyState.hidden = true;
        cropCanvas.hidden = false;
        cropHelp.hidden = false;
        gridOption.hidden = false;
  
        resetButton.disabled = false;
        saveButton.disabled = false;
  
        options.setStatus?.(
          "Image loaded into crop editor",
        );
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "The image could not be loaded.",
        );
      }
    }
  
  
    async function save(): Promise<void> {
      clearError();
  
      if (
        !selectedFile ||
        !cropCanvasController
      ) {
        showError(
          "Choose an image first.",
        );
  
        return;
      }
  
      const name =
        nameInput.value.trim();
  
      if (!name) {
        showError(
          "Enter a name for the custom icon.",
        );
  
        nameInput.focus();
        return;
      }
  
      try {
        const dataUrl =
          cropCanvasController
            .exportDataUrl(32);
  
        const icon:
          CustomIconEntry = {
            id:
              `custom_${createIconId(name)}`,
  
            name,
            aliases: [
              name.toLowerCase(),
            ],
            dataUrl,
            createdAt:
              new Date().toISOString(),
          };
  
        addCustomIcon(icon);
  
        await options.onSaved?.(icon);
  
        options.setStatus?.(
          `Imported custom icon “${name}”`,
        );
  
        close();
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "The icon could not be saved.",
        );
      }
    }
  
  
    function handlePaste(
      event: ClipboardEvent,
    ): void {
      const imageItem =
        Array.from(
          event.clipboardData?.items ??
            [],
        ).find((item) =>
          item.type.startsWith(
            "image/",
          ),
        );
  
      const file =
        imageItem?.getAsFile();
  
      if (!file) {
        return;
      }
  
      event.preventDefault();
  
      void loadSelectedFile(file);
    }
  
  
    dropzone.addEventListener(
      "click",
      () => {
        if (cropCanvasController) {
          return;
        }
  
        fileInput.click();
      },
    );
  
  
    fileInput.addEventListener(
      "change",
      () => {
        const file =
          fileInput.files?.[0];
  
        if (file) {
          void loadSelectedFile(file);
        }
      },
    );
  
  
    dropzone.addEventListener(
      "dragover",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
  
        dropzone.classList.add(
          "dragging",
        );
      },
    );
  
  
    dropzone.addEventListener(
      "dragleave",
      (event) => {
        event.preventDefault();
  
        dropzone.classList.remove(
          "dragging",
        );
      },
    );
  
  
    dropzone.addEventListener(
      "drop",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
  
        dropzone.classList.remove(
          "dragging",
        );
  
        const file =
          event.dataTransfer
            ?.files[0];
  
        if (file) {
          void loadSelectedFile(file);
        }
      },
    );
  
  
    resetButton.addEventListener(
      "click",
      () => {
        cropCanvasController?.reset();
  
        options.setStatus?.(
          "Crop reset",
        );
      },
    );
  
  
    saveButton.addEventListener(
      "click",
      () => {
        void save();
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
        if (
          event.target === backdrop
        ) {
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
  
        if (
          event.key === "Enter" &&
          event.ctrlKey
        ) {
          void save();
        }
      },
    );
  
    document.addEventListener(
      "paste",
      handlePaste,
    );

    gridCheckbox.addEventListener(
      "change",
      () => {
        cropCanvasController?.setGridVisible(
          gridCheckbox.checked,
        );
      },
    );
  
    if (selectedFile) {
      void loadSelectedFile(
        selectedFile,
      );
    }
  
    window.setTimeout(() => {
      dropzone.focus();
    });
  }