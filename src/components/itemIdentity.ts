import type { MarketListing } from "../types/listing.ts";

export interface ItemIdentityOptions {
  showCoordinates?: boolean;
  showUniversalBadge?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createItemInitial(itemName: string): string {
  const words = itemName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase())
    .join("");
}

export function renderItemIdentity(
  listing: MarketListing,
  options: ItemIdentityOptions = {},
): string {
  const {
    showCoordinates = true,
    showUniversalBadge = true,
  } = options;

  const secondaryLines: string[] = [];

  if (
    showUniversalBadge &&
    listing.universalPrice
  ) {
    secondaryLines.push(`
      <span class="item-identity-badge universal">
        Universal price
      </span>
    `);
  }

  if (
    showCoordinates &&
    !listing.universalPrice &&
    listing.shopCoordinates
  ) {
    secondaryLines.push(`
      <span class="item-identity-detail">
        ${escapeHtml(listing.shopCoordinates)}
      </span>
    `);
  }

  return `
    <div class="item-identity">
      <div
        class="item-icon"
        data-item="${escapeHtml(listing.item)}"
        aria-hidden="true"
      >
        ${createItemInitial(listing.item)}
      </div>

      <div class="item-identity-copy">
        <strong class="item-identity-name">
          ${escapeHtml(listing.item)}
        </strong>

        ${
          secondaryLines.length > 0
            ? `
              <div class="item-identity-details">
                ${secondaryLines.join("")}
              </div>
            `
            : ""
        }
      </div>
    </div>
  `;
}