import type {
  MarketListing,
} from "../types/listing.ts";


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
        data-icon-id="${escapeHtml(listing.iconId ?? "")}"
        aria-hidden="true"
      >
        ?
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