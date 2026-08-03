import type {
    BuiltInIconEntry,
    CustomIconEntry,
    ResolvedItemIcon,
  } from "../types/icon.ts";
  
  const ICON_BASE_PATH =
    `${import.meta.env.BASE_URL}data/icons`;
  
  const ICON_INDEX_PATH =
    `${import.meta.env.BASE_URL}data/icon-index.json`;
  
  const CUSTOM_ICONS_STORAGE_KEY =
    "grass-market-calculator.custom-icons";
  
  interface BuiltInIconIndex {
    icons: BuiltInIconEntry[];
  }
  
  let builtInIcons: BuiltInIconEntry[] = [];
  let builtInIconsLoaded = false;
  
  const resolvedIconCache =
    new Map<string, ResolvedItemIcon | null>();
  
  
  function normalizeName(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");
  }
  
  
  function createIconId(name: string): string {
    return normalizeName(name)
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, "_");
  }
  
  
  export async function loadBuiltInIconIndex(): Promise<
    BuiltInIconEntry[]
  > {
    if (builtInIconsLoaded) {
      return [...builtInIcons];
    }
  
    try {
      const response = await fetch(ICON_INDEX_PATH, {
        cache: "no-cache",
      });
  
      if (!response.ok) {
        throw new Error(
          `Could not load icon index: ${response.status}`,
        );
      }
  
      const parsed =
        (await response.json()) as BuiltInIconIndex;
  
      builtInIcons = Array.isArray(parsed.icons)
        ? parsed.icons
        : [];
  
      builtInIconsLoaded = true;
      resolvedIconCache.clear();
  
      return [...builtInIcons];
    } catch (error) {
      console.error("Failed to load icon index.", error);
  
      builtInIcons = [];
      builtInIconsLoaded = true;
  
      return [];
    }
  }
  
  
  export function loadCustomIcons(): CustomIconEntry[] {
    const saved =
      localStorage.getItem(CUSTOM_ICONS_STORAGE_KEY);
  
    if (!saved) {
      return [];
    }
  
    try {
      const parsed = JSON.parse(saved) as unknown;
  
      return Array.isArray(parsed)
        ? (parsed as CustomIconEntry[])
        : [];
    } catch {
      return [];
    }
  }
  
  
  function saveCustomIcons(
    icons: CustomIconEntry[],
  ): void {
    localStorage.setItem(
      CUSTOM_ICONS_STORAGE_KEY,
      JSON.stringify(icons),
    );
  
    resolvedIconCache.clear();
  }
  
  
  export function addCustomIcon(
    icon: CustomIconEntry,
  ): void {
    const icons = loadCustomIcons();
  
    const withoutExisting = icons.filter(
      (existing) => existing.id !== icon.id,
    );
  
    saveCustomIcons([
      ...withoutExisting,
      icon,
    ]);
  }
  
  
  export function deleteCustomIcon(
    iconId: string,
  ): void {
    const icons = loadCustomIcons().filter(
      (icon) => icon.id !== iconId,
    );
  
    saveCustomIcons(icons);
  }
  
  
  function matchesIcon(
    itemName: string,
    iconName: string,
    aliases: string[],
  ): boolean {
    const normalizedItem = normalizeName(itemName);
  
    if (normalizeName(iconName) === normalizedItem) {
      return true;
    }
  
    return aliases.some(
      (alias) =>
        normalizeName(alias) === normalizedItem,
    );
  }
  
  
  export async function resolveItemIcon(
    itemName: string,
    explicitIconId: string | null = null,
  ): Promise<ResolvedItemIcon | null> {
    if (explicitIconId) {
      const explicitIcon =
        await getIconById(explicitIconId);
  
      if (explicitIcon) {
        return explicitIcon;
      }
    }
  
    const normalizedItem =
      normalizeName(itemName);
  
    if (resolvedIconCache.has(normalizedItem)) {
      return (
        resolvedIconCache.get(normalizedItem) ?? null
      );
    }
  
    const customIcons = loadCustomIcons();
  
    const customMatch =
      customIcons.find((icon) =>
        matchesIcon(
          itemName,
          icon.name,
          icon.aliases,
        ),
      );
  
    if (customMatch) {
      const result: ResolvedItemIcon = {
        id: customMatch.id,
        name: customMatch.name,
        url: customMatch.dataUrl,
        custom: true,
      };
  
      resolvedIconCache.set(
        normalizedItem,
        result,
      );
  
      return result;
    }
  
    await loadBuiltInIconIndex();
  
    const builtInMatch =
      builtInIcons.find((icon) =>
        matchesIcon(
          itemName,
          icon.name,
          icon.aliases,
        ),
      );
  
    if (!builtInMatch) {
      resolvedIconCache.set(
        normalizedItem,
        null,
      );
  
      return null;
    }
  
    const result: ResolvedItemIcon = {
      id: builtInMatch.id,
      name: builtInMatch.name,
      url:
        `${ICON_BASE_PATH}/${builtInMatch.filename}`,
      custom: false,
    };
  
    resolvedIconCache.set(
      normalizedItem,
      result,
    );
  
    return result;
  }
  
  
  export async function hydrateItemIcons(
    container: ParentNode,
  ): Promise<void> {
    const iconElements =
      container.querySelectorAll<HTMLElement>(
        ".item-icon[data-item]",
      );
  
    await Promise.all(
        Array.from(iconElements).map(async (iconElement) => {
        const itemName =
          iconElement.dataset.item?.trim();
  
        if (!itemName) {
          return;
        }
  
        const explicitIconId =
          iconElement.dataset.iconId?.trim() || null;

        const resolved =
          await resolveItemIcon(
            itemName,
            explicitIconId,
          );
  
        if (!resolved) {
          iconElement.replaceChildren("?");
          iconElement.classList.add("missing-icon");
          iconElement.classList.remove("has-image");
          return;
        }
  
        const image = new Image();
  
        image.alt = "";
        image.draggable = false;
        image.src = resolved.url;
  
        image.addEventListener("load", () => {
          iconElement.replaceChildren(image);
          iconElement.classList.add("has-image");
          iconElement.classList.remove("missing-icon");
        });
  
        image.addEventListener("error", () => {
          iconElement.replaceChildren("?");
          iconElement.classList.add("missing-icon");
          iconElement.classList.remove("has-image");
        });
      }),
    );
  }
  
  
  export async function getAllAvailableIcons(): Promise<
    ResolvedItemIcon[]
  > {
    await loadBuiltInIconIndex();
  
    const custom = loadCustomIcons().map(
      (icon): ResolvedItemIcon => ({
        id: icon.id,
        name: icon.name,
        url: icon.dataUrl,
        custom: true,
      }),
    );
  
    const builtIn = builtInIcons.map(
      (icon): ResolvedItemIcon => ({
        id: icon.id,
        name: icon.name,
        url: `${ICON_BASE_PATH}/${icon.filename}`,
        custom: false,
      }),
    );
  
    return [
      ...custom,
      ...builtIn,
    ].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }
  
  
  export async function convertImageToIcon(
    file: Blob,
    name: string,
  ): Promise<CustomIconEntry> {
    const sourceUrl = URL.createObjectURL(file);
  
    try {
      const sourceImage = await loadImage(sourceUrl);
  
      const canvas =
        document.createElement("canvas");
  
      canvas.width = 32;
      canvas.height = 32;
  
      const context = canvas.getContext("2d");
  
      if (!context) {
        throw new Error(
          "Canvas rendering is unavailable.",
        );
      }
  
      context.clearRect(0, 0, 32, 32);
      context.imageSmoothingEnabled = false;
  
      const availableSize = 28;
  
      const scale = Math.min(
        availableSize / sourceImage.naturalWidth,
        availableSize / sourceImage.naturalHeight,
      );
  
      const width = Math.max(
        1,
        Math.round(
          sourceImage.naturalWidth * scale,
        ),
      );
  
      const height = Math.max(
        1,
        Math.round(
          sourceImage.naturalHeight * scale,
        ),
      );
  
      const x = Math.floor((32 - width) / 2);
      const y = Math.floor((32 - height) / 2);
  
      context.drawImage(
        sourceImage,
        x,
        y,
        width,
        height,
      );
  
      const dataUrl =
        canvas.toDataURL("image/png");
  
      return {
        id: `custom_${createIconId(name)}`,
        name: name.trim(),
        aliases: [
          normalizeName(name),
        ],
        dataUrl,
        createdAt: new Date().toISOString(),
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  export async function getIconById(
    iconId: string,
  ): Promise<ResolvedItemIcon | null> {
    const customIcon =
      loadCustomIcons().find(
        (icon) => icon.id === iconId,
      );
  
    if (customIcon) {
      return {
        id: customIcon.id,
        name: customIcon.name,
        url: customIcon.dataUrl,
        custom: true,
      };
    }
  
    await loadBuiltInIconIndex();
  
    const builtInIcon =
      builtInIcons.find(
        (icon) => icon.id === iconId,
      );
  
    if (!builtInIcon) {
      return null;
    }
  
    return {
      id: builtInIcon.id,
      name: builtInIcon.name,
      url: `${ICON_BASE_PATH}/${builtInIcon.filename}`,
      custom: false,
    };
  }
  
  function loadImage(
    source: string,
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
  
      image.addEventListener(
        "load",
        () => resolve(image),
        { once: true },
      );
  
      image.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              "The selected image could not be loaded.",
            ),
          ),
        { once: true },
      );
  
      image.src = source;
    });
  }