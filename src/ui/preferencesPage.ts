import {
    addCustomIcon,
    deleteCustomIcon,
    getAllAvailableIcons,
    loadBuiltInIconIndex,
    loadCustomIcons,
  } from "../services/itemIconService.ts";
  
  import {
    openIconImporterDialog,
  } from "../components/IconImporterDialog.ts";

  import type {
    ResolvedItemIcon,
  } from "../types/icon.ts";
  
  
  interface PreferencesPageOptions {
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
  
  
  function getStoredIconBytes(): number {
    const encoded =
      localStorage.getItem(
        "grass-market-calculator.custom-icons",
      ) ?? "";
  
    return new Blob([encoded]).size;
  }
  
  
  function formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
  
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
  
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }
  
  
  export function renderPreferencesPage(
    container: HTMLElement,
    options: PreferencesPageOptions,
  ): () => void {
    let icons: ResolvedItemIcon[] = [];
    let selectedFile: Blob | null = null;
    let cropImage: HTMLImageElement | null = null;
    let cropScale = 1;
    let cropOffsetX = 0;
    let cropOffsetY = 0;

    let cropDragging = false;
    let cropLastX = 0;
    let cropLastY = 0;
  
    container.innerHTML = `
      <section class="page-header">
        <div>
          <h2>Preferences</h2>
  
          <p>
            Manage themes, icons, application data,
            and accessibility.
          </p>
        </div>
      </section>
  
      <section class="preferences-layout">
        <nav class="preferences-tabs">
          <button
            class="preferences-tab active"
            type="button"
          >
            Icons
          </button>
  
          <button
            class="preferences-tab"
            type="button"
            disabled
          >
            Themes
          </button>
  
          <button
            class="preferences-tab"
            type="button"
            disabled
          >
            General
          </button>
        </nav>
  
        <section class="content-card">
          <div class="preferences-section-header">
            <div>
              <span class="page-eyebrow">
                Icon library
              </span>
  
              <h3>Item icons</h3>
  
              <p>
                Browse built-in Minecraft icons or import
                custom PNG images.
              </p>
            </div>
  
            <div class="icon-action-row">
              <button
                id="refresh-icon-list"
                class="secondary-button"
                type="button"
              >
                Update icon list
              </button>
  
              <button
                id="open-icon-import"
                class="primary-button"
                type="button"
              >
                Import new icon
              </button>
            </div>
          </div>
  
          <div
            id="icon-import-area"
            class="icon-import-area"
            hidden
            tabindex="0"
          >
        <div
            id="icon-cropper"
            class="icon-import-preview icon-cropper"
        >
            <span id="icon-import-placeholder">
                Drop an image here
            </span>

            <canvas
                id="icon-crop-canvas"
                width="256"
                height="256"
                hidden
            ></canvas>
        </div>

        <div
            id="icon-crop-controls"
            class="icon-crop-controls"
            hidden
        >
            <label>
                Zoom

                <input
                id="icon-crop-zoom"
                type="range"
                min="1"
                max="6"
                step="0.05"
                value="1"
                />
            </label>

            <button
                id="reset-icon-crop"
                class="secondary-button"
                type="button"
            >
                Reset crop
            </button>
            </div>
  
            <div class="icon-import-copy">
              <strong>
                Drop, paste, or click to select an image
              </strong>
  
              <span>
                It will be centered and converted to a
                transparent 32×32 PNG.
              </span>
  
              <label>
                Custom icon name
  
                <input
                  id="custom-icon-name"
                  type="text"
                  placeholder="Example: Special Map"
                />
              </label>
  
              <div class="icon-import-buttons">
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
              </div>
  
              <p
                id="icon-import-error"
                class="form-error"
                hidden
              ></p>
            </div>
  
            <input
              id="icon-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
            />
          </div>
  
          <div class="icon-gallery-shell">
            <div
              id="icon-gallery"
              class="icon-gallery"
            ></div>
  
            <div
              id="icon-gallery-empty"
              class="empty-state"
              hidden
            >
              No icons match this search.
            </div>
          </div>
  
          <input
            id="icon-gallery-search"
            class="icon-gallery-search"
            type="search"
            placeholder="Search current icons…"
          />
  
          <div class="icon-library-footer">
            <span id="icon-update-info">
              Loading icon library…
            </span>
  
            <span id="icon-storage-info">
              Custom storage: 0 B
            </span>
          </div>
        </section>
      </section>
    `;
  
    const gallery =
      container.querySelector<HTMLDivElement>(
        "#icon-gallery",
      )!;
  
    const galleryEmpty =
      container.querySelector<HTMLDivElement>(
        "#icon-gallery-empty",
      )!;
  
    const gallerySearch =
      container.querySelector<HTMLInputElement>(
        "#icon-gallery-search",
      )!;
  
    const updateInfo =
      container.querySelector<HTMLElement>(
        "#icon-update-info",
      )!;
  
    const storageInfo =
      container.querySelector<HTMLElement>(
        "#icon-storage-info",
      )!;
  
    const refreshButton =
      container.querySelector<HTMLButtonElement>(
        "#refresh-icon-list",
      )!;
  
    const openImportButton =
      container.querySelector<HTMLButtonElement>(
        "#open-icon-import",
      )!;
  
    const importArea =
      container.querySelector<HTMLDivElement>(
        "#icon-import-area",
      )!;
  
    const fileInput =
      container.querySelector<HTMLInputElement>(
        "#icon-file-input",
      )!;
    
    const cropCanvas =
      container.querySelector<HTMLCanvasElement>(
        "#icon-crop-canvas",
      )!;
    
    const cropContext =
      cropCanvas.getContext("2d")!;
    
    const cropControls =
      container.querySelector<HTMLDivElement>(
        "#icon-crop-controls",
      )!;
    
    const cropZoom =
      container.querySelector<HTMLInputElement>(
        "#icon-crop-zoom",
      )!;
    
    const resetCropButton =
      container.querySelector<HTMLButtonElement>(
        "#reset-icon-crop",
      )!;
  
    const previewPlaceholder =
      container.querySelector<HTMLElement>(
        "#icon-import-placeholder",
      )!;
  
    const nameInput =
      container.querySelector<HTMLInputElement>(
        "#custom-icon-name",
      )!;
  
    const saveButton =
      container.querySelector<HTMLButtonElement>(
        "#save-custom-icon",
      )!;
  
    const cancelButton =
      container.querySelector<HTMLButtonElement>(
        "#cancel-icon-import",
      )!;
  
    const importError =
      container.querySelector<HTMLParagraphElement>(
        "#icon-import-error",
      )!;
  
  
    function updateMetadata(): void {
      const customCount =
        loadCustomIcons().length;
  
      updateInfo.textContent =
        `${icons.length} icons available · ` +
        `${customCount} custom`;
  
      storageInfo.textContent =
        `Custom storage: ${
          formatBytes(getStoredIconBytes())
        }`;
    }

    function fitCropImage(): void {
        if (!cropImage) {
          return;
        }
      
        const scaleX =
          cropCanvas.width / cropImage.naturalWidth;
      
        const scaleY =
          cropCanvas.height / cropImage.naturalHeight;
      
        cropScale = Math.max(scaleX, scaleY);
      
        cropOffsetX =
          (cropCanvas.width -
            cropImage.naturalWidth * cropScale) / 2;
      
        cropOffsetY =
          (cropCanvas.height -
            cropImage.naturalHeight * cropScale) / 2;
      
        cropZoom.value = "1";
      
        drawCrop();
      }
      
      
      function drawCrop(): void {
        cropContext.clearRect(
          0,
          0,
          cropCanvas.width,
          cropCanvas.height,
        );
      
        cropContext.fillStyle = "transparent";
      
        if (!cropImage) {
          return;
        }
      
        const width =
          cropImage.naturalWidth * cropScale;
      
        const height =
          cropImage.naturalHeight * cropScale;
      
        cropContext.imageSmoothingEnabled = false;
      
        cropContext.drawImage(
          cropImage,
          cropOffsetX,
          cropOffsetY,
          width,
          height,
        );
      }
      
      
      function clampCropPosition(): void {
        if (!cropImage) {
          return;
        }
      
        const width =
          cropImage.naturalWidth * cropScale;
      
        const height =
          cropImage.naturalHeight * cropScale;
      
        const minX = cropCanvas.width - width;
        const minY = cropCanvas.height - height;
      
        cropOffsetX = Math.min(
          0,
          Math.max(minX, cropOffsetX),
        );
      
        cropOffsetY = Math.min(
          0,
          Math.max(minY, cropOffsetY),
        );
      }
      
      
      function setCropZoom(multiplier: number): void {
        if (!cropImage) {
          return;
        }
      
        const centerX = cropCanvas.width / 2;
        const centerY = cropCanvas.height / 2;
      
        const imagePointX =
          (centerX - cropOffsetX) / cropScale;
      
        const imagePointY =
          (centerY - cropOffsetY) / cropScale;
      
        const baseScale = Math.max(
          cropCanvas.width / cropImage.naturalWidth,
          cropCanvas.height / cropImage.naturalHeight,
        );
      
        cropScale = baseScale * multiplier;
      
        cropOffsetX =
          centerX - imagePointX * cropScale;
      
        cropOffsetY =
          centerY - imagePointY * cropScale;
      
        clampCropPosition();
        drawCrop();
      }
  
  
    function renderGallery(): void {
      const query =
        gallerySearch.value
          .trim()
          .toLowerCase();
  
      const visible = icons.filter((icon) =>
        icon.name.toLowerCase().includes(query),
      );
  
      gallery.innerHTML = visible
        .map(
          (icon) => `
            <article
              class="icon-gallery-item"
              data-id="${escapeHtml(icon.id)}"
            >
              <div class="icon-gallery-image">
                <img
                  src="${escapeHtml(icon.url)}"
                  alt=""
                  loading="lazy"
                />
  
                <span class="icon-gallery-fallback">
                  ?
                </span>
              </div>
  
              <span title="${escapeHtml(icon.name)}">
                ${escapeHtml(icon.name)}
              </span>
  
              ${
                icon.custom
                  ? `
                    <button
                      class="remove-custom-icon"
                      type="button"
                      data-remove-icon="${escapeHtml(icon.id)}"
                      title="Remove custom icon"
                    >
                      ×
                    </button>
                  `
                  : ""
              }
            </article>
          `,
        )
        .join("");
  
      gallery.hidden = visible.length === 0;
      galleryEmpty.hidden = visible.length !== 0;
  
      gallery
        .querySelectorAll<HTMLImageElement>("img")
        .forEach((image) => {
          image.addEventListener("error", () => {
            image.hidden = true;
          });
        });
  
      gallery
        .querySelectorAll<HTMLButtonElement>(
          "[data-remove-icon]",
        )
        .forEach((button) => {
          button.addEventListener("click", async () => {
            const iconId =
              button.dataset.removeIcon;
  
            if (!iconId) {
              return;
            }
  
            const confirmed = window.confirm(
              "Remove this custom icon?",
            );
  
            if (!confirmed) {
              return;
            }
  
            deleteCustomIcon(iconId);
            await reloadIcons();
  
            options.setStatus(
              "Custom icon removed",
            );
          });
        });
    }
  
  
    async function reloadIcons(): Promise<void> {
      icons = await getAllAvailableIcons();
  
      renderGallery();
      updateMetadata();
    }
  
  
    function resetImport(): void {
        selectedFile = null;

        importArea.setAttribute("hidden", "");
        nameInput.value = "";
        fileInput.value = "";

        previewPlaceholder.hidden = false;
        saveButton.disabled = true;

        importError.hidden = true;
        importError.textContent = "";

        cropImage = null;
        cropScale = 1;
        cropOffsetX = 0;
        cropOffsetY = 0;
        cropDragging = false;

        cropCanvas.hidden = true;
        cropControls.hidden = true;

        cropContext.clearRect(
        0,
        0,
        cropCanvas.width,
        cropCanvas.height,
        );

        previewPlaceholder.hidden = false;
    }
  
  
    async function selectImage(
        file: Blob,
      ): Promise<void> {
        if (!file.type.startsWith("image/")) {
          importError.textContent =
            "Please select an image file.";
      
          importError.hidden = false;
          return;
        }
      
        selectedFile = file;
      
        const sourceUrl =
          URL.createObjectURL(file);
      
        const image = new Image();
      
        image.addEventListener(
          "load",
          () => {
            cropImage = image;
      
            previewPlaceholder.hidden = true;
            cropCanvas.hidden = false;
            cropControls.hidden = false;
      
            fitCropImage();
      
            saveButton.disabled = false;
      
            URL.revokeObjectURL(sourceUrl);
          },
          { once: true },
        );
      
        image.addEventListener(
          "error",
          () => {
            importError.textContent =
              "The selected image could not be loaded.";
      
            importError.hidden = false;
      
            URL.revokeObjectURL(sourceUrl);
          },
          { once: true },
        );
      
        image.src = sourceUrl;
      }
  
  
      async function saveImportedIcon(): Promise<void> {
        if (!selectedFile || !cropImage) {
          return;
        }
      
        const name = nameInput.value.trim();
      
        if (!name) {
          importError.textContent =
            "Enter a name for the custom icon.";
      
          importError.hidden = false;
          return;
        }
      
        try {
          const outputCanvas =
            document.createElement("canvas");
      
          outputCanvas.width = 32;
          outputCanvas.height = 32;
      
          const outputContext =
            outputCanvas.getContext("2d");
      
          if (!outputContext) {
            throw new Error(
              "Canvas rendering is unavailable.",
            );
          }
      
          outputContext.imageSmoothingEnabled = false;
      
          outputContext.drawImage(
            cropCanvas,
            0,
            0,
            cropCanvas.width,
            cropCanvas.height,
            0,
            0,
            32,
            32,
          );
      
          const dataUrl =
            outputCanvas.toDataURL("image/png");
      
          const icon = {
            id: `custom_${name
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "_")
              .replace(/^_+|_+$/g, "")}`,
      
            name,
            aliases: [name.toLowerCase()],
            dataUrl,
            createdAt: new Date().toISOString(),
          };
      
          addCustomIcon(icon);
      
          await reloadIcons();
          resetImport();
      
          options.setStatus(
            `Imported custom icon “${name}”`,
          );
        } catch (error) {
          importError.textContent =
            error instanceof Error
              ? error.message
              : "The icon could not be imported.";
      
          importError.hidden = false;
        }
      }
  
  
    refreshButton.addEventListener(
      "click",
      async () => {
        refreshButton.disabled = true;
        refreshButton.textContent =
          "Updating icon list…";
  
        await loadBuiltInIconIndex();
        await reloadIcons();
  
        refreshButton.disabled = false;
        refreshButton.textContent =
          "Update icon list";
  
        options.setStatus(
          `Loaded ${icons.length} icons`,
        );
      },
    );
  
  
    openImportButton.addEventListener(
        "click",
        () => {
          openIconImporterDialog({
            setStatus: options.setStatus,
      
            onSaved: async () => {
              await reloadIcons();
            },
          });
      
          options.setStatus("Icon importer opened");
        },
      );
  
  
    importArea.addEventListener(
      "click",
      (event) => {
        const target =
          event.target as HTMLElement;
  
        if (
          target.closest("button") ||
          target.closest("input")
        ) {
          return;
        }
  
        fileInput.click();
      },
    );
  
  
    fileInput.addEventListener(
      "change",
      () => {
        const file = fileInput.files?.[0];
  
        if (file) {
          selectImage(file);
        }
      },
    );
  
  
    importArea.addEventListener(
      "dragover",
      (event) => {
        event.preventDefault();
        importArea.classList.add("dragging");
      },
    );
  
  
    importArea.addEventListener(
      "dragleave",
      () => {
        importArea.classList.remove("dragging");
      },
    );
  
  
    importArea.addEventListener(
      "drop",
      (event) => {
        event.preventDefault();
        importArea.classList.remove("dragging");
  
        const file =
          event.dataTransfer?.files[0];
  
        if (file) {
          selectImage(file);
        }
      },
    );
  
  
    document.addEventListener(
      "paste",
      handlePaste,
    );
  
  
    function handlePaste(
        event: ClipboardEvent,
      ): void {
        if (importArea.hasAttribute("hidden")) {
            return;
          }
      
        const imageItem =
          Array.from(event.clipboardData?.items ?? [])
            .find((item) =>
              item.type.startsWith("image/"),
            );
      
        const file = imageItem?.getAsFile();
      
        if (file) {
          event.preventDefault();
          selectImage(file);
        }
      }
  
  
    gallerySearch.addEventListener(
      "input",
      renderGallery,
    );
  
    saveButton.addEventListener(
      "click",
      () => void saveImportedIcon(),
    );
  
    cancelButton.addEventListener(
      "click",
      resetImport,
    );

    cropZoom.addEventListener(
        "input",
        () => {
          setCropZoom(
            Number(cropZoom.value),
          );
        },
      );
      
      
      resetCropButton.addEventListener(
        "click",
        fitCropImage,
      );
      
      
      cropCanvas.addEventListener(
        "mousedown",
        (event) => {
          if (!cropImage) {
            return;
          }
      
          cropDragging = true;
          cropLastX = event.clientX;
          cropLastY = event.clientY;
        },
      );
      
      
      window.addEventListener(
        "mousemove",
        (event) => {
          if (!cropDragging || !cropImage) {
            return;
          }
      
          cropOffsetX +=
            event.clientX - cropLastX;
      
          cropOffsetY +=
            event.clientY - cropLastY;
      
          cropLastX = event.clientX;
          cropLastY = event.clientY;
      
          clampCropPosition();
          drawCrop();
        },
      );
      
      
      window.addEventListener(
        "mouseup",
        () => {
          cropDragging = false;
        },
      );
      
      
      cropCanvas.addEventListener(
        "wheel",
        (event) => {
          if (!cropImage) {
            return;
          }
      
          event.preventDefault();
      
          const current =
            Number(cropZoom.value);
      
          const next = Math.min(
            6,
            Math.max(
              1,
              current +
                (event.deltaY < 0 ? 0.1 : -0.1),
            ),
          );
      
          cropZoom.value =
            String(next);
      
          setCropZoom(next);
        },
        { passive: false },
      );
  
  
    void reloadIcons();
  
    return () => {
      document.removeEventListener(
        "paste",
        handlePaste,
      );
    };
  }