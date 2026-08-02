const ICON_BASE_PATH =
  `${import.meta.env.BASE_URL}data/icons`;

function normalizeIconName(itemName: string): string {
  return itemName
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getItemIconUrl(
  itemName: string,
): string {
  const filename = normalizeIconName(itemName);

  return `${ICON_BASE_PATH}/${filename}.png`;
}

export function hydrateItemIcons(
  container: ParentNode,
): void {
  const iconElements =
    container.querySelectorAll<HTMLElement>(
      ".item-icon[data-item]",
    );

  iconElements.forEach((iconElement) => {
    if (iconElement.dataset.loaded === "true") {
      return;
    }

    const itemName =
      iconElement.dataset.item?.trim();

    if (!itemName) {
      return;
    }

    iconElement.dataset.loaded = "true";

    const image = new Image();
    image.alt = "";
    image.draggable = false;
    image.src = getItemIconUrl(itemName);

    image.addEventListener("load", () => {
      iconElement.replaceChildren(image);
      iconElement.classList.add("has-image");
    });

    image.addEventListener("error", () => {
      iconElement.classList.add("missing-icon");
      iconElement.textContent = "?";
    });
  });
}