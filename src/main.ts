import "./style.css";

import {
  loadItemCatalog,
  searchItems,
  type ItemCatalog,
} from "./data/itemCatalog.ts";
import { renderListingPage } from "./ui/listingPage.ts";
import { renderMarketPage } from "./ui/marketPage.ts";

type PageName = "buying" | "selling" | "market";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">G</div>

        <div>
          <h1>Grass Market Calculator</h1>
          <p>Minecraft Java Edition 1.19.2</p>
        </div>
      </div>

      <div class="topbar-actions">
        <div class="global-search-container">
          <div class="global-search-wrapper">
            <input
              id="global-search"
              class="global-search"
              type="search"
              autocomplete="off"
              placeholder="Search the market…"
              aria-label="Search market listings"
            />

            <span id="global-inline-completion" class="inline-completion"></span>

            <div
              id="global-suggestions"
              class="global-suggestions"
              hidden
            ></div>
          </div>

          <span class="autocomplete-help">
            Press Tab to autocomplete
          </span>
        </div>

        <a
          class="github-link"
          href="https://github.com/sylviacrisptu/GrassMarketCalculator/issues"
          target="_blank"
          rel="noreferrer"
        >
          Support
        </a>
      </div>
    </header>

    <nav class="tabs">
      <button class="tab active" data-page="buying">
        Buying Items
      </button>

      <button class="tab" data-page="selling">
        Selling Items
      </button>

      <button class="tab" data-page="market">
        Market Prices
      </button>

      <button class="tab" disabled>Crafting</button>
      <button class="tab" disabled>Storage</button>
      <button class="tab" disabled>History</button>
    </nav>

    <main id="page-content" class="page">
      <section class="panel">Loading item catalog…</section>
    </main>

    <footer id="statusbar" class="statusbar">
      Starting…
    </footer>
  </div>
`;

const pageContent =
  document.querySelector<HTMLElement>("#page-content")!;

const statusbar =
  document.querySelector<HTMLElement>("#statusbar")!;

const tabs =
  document.querySelectorAll<HTMLButtonElement>(".tab[data-page]");

const globalSearch =
  document.querySelector<HTMLInputElement>("#global-search")!;

const globalSuggestions =
  document.querySelector<HTMLDivElement>("#global-suggestions")!;

const inlineCompletion =
  document.querySelector<HTMLSpanElement>("#global-inline-completion")!;

let cleanupCurrentPage: (() => void) | null = null;
let catalog: ItemCatalog;
let selectedGlobalSuggestion = -1;

function setStatus(message: string): void {
  statusbar.textContent = message;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getGlobalSuggestions(): string[] {
  const query = globalSearch.value.trim();

  if (!query || !catalog) {
    return [];
  }

  return searchItems(query, catalog, 30);
}

function updateInlineCompletion(): void {
  const typed = globalSearch.value;
  const suggestions = getGlobalSuggestions();
  const first = suggestions[0];

  if (
    !typed ||
    !first ||
    !first.toLowerCase().startsWith(typed.toLowerCase()) ||
    first.toLowerCase() === typed.toLowerCase()
  ) {
    inlineCompletion.textContent = "";
    inlineCompletion.style.left = "";
    return;
  }

  const remainder = first.slice(typed.length);
  inlineCompletion.textContent = remainder;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const computedStyle = window.getComputedStyle(globalSearch);

  context.font = [
    computedStyle.fontStyle,
    computedStyle.fontWeight,
    computedStyle.fontSize,
    computedStyle.fontFamily,
  ].join(" ");

  const typedWidth = context.measureText(typed).width;
  const leftPadding = Number.parseFloat(computedStyle.paddingLeft) || 14;

  inlineCompletion.style.left = `${leftPadding + typedWidth + 2}px`;
}

function renderGlobalSuggestions(): void {
  selectedGlobalSuggestion = -1;

  const query = globalSearch.value.trim();
  const suggestions = getGlobalSuggestions();

  updateInlineCompletion();

  if (!query || suggestions.length === 0) {
    globalSuggestions.hidden = true;
    globalSuggestions.innerHTML = "";
    return;
  }

  globalSuggestions.innerHTML = suggestions
    .map(
      (item, index) => `
        <button
          class="global-suggestion"
          type="button"
          data-index="${index}"
          data-item="${escapeHtml(item)}"
        >
          <span>${escapeHtml(item)}</span>
          <small>Item</small>
        </button>
      `,
    )
    .join("");

  globalSuggestions.hidden = false;

  globalSuggestions
    .querySelectorAll<HTMLButtonElement>(".global-suggestion")
    .forEach((button) => {
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();

        globalSearch.value = button.dataset.item ?? "";
        inlineCompletion.textContent = "";
        globalSuggestions.hidden = true;

        performGlobalSearch();
      });
    });
}

function highlightGlobalSuggestion(): void {
  const buttons =
    globalSuggestions.querySelectorAll<HTMLButtonElement>(
      ".global-suggestion",
    );

  buttons.forEach((button, index) => {
    button.classList.toggle(
      "selected",
      index === selectedGlobalSuggestion,
    );
  });

  buttons[selectedGlobalSuggestion]?.scrollIntoView({
    block: "nearest",
  });
}

function acceptGlobalSuggestion(): boolean {
  const suggestions = getGlobalSuggestions();

  if (suggestions.length === 0) {
    return false;
  }

  const index =
    selectedGlobalSuggestion >= 0
      ? selectedGlobalSuggestion
      : 0;

  globalSearch.value = suggestions[index];
  inlineCompletion.textContent = "";
  globalSuggestions.hidden = true;

  return true;
}

function openPage(page: PageName, marketQuery = ""): void {
  cleanupCurrentPage?.();
  cleanupCurrentPage = null;

  tabs.forEach((tab) => {
    tab.classList.toggle(
      "active",
      tab.dataset.page === page,
    );
  });

  if (page === "market") {
    cleanupCurrentPage = renderMarketPage(
      pageContent,
      setStatus,
      marketQuery,
    );
  } else {
    cleanupCurrentPage = renderListingPage(pageContent, {
      type: page,
      catalog,
      setStatus,
    });
  }

  setStatus(
    page === "market" && marketQuery
      ? `Searching market for “${marketQuery}”`
      : `Opened ${page} page`,
  );
}

function performGlobalSearch(): void {
  const query = globalSearch.value.trim();

  globalSuggestions.hidden = true;
  inlineCompletion.textContent = "";

  openPage("market", query);

  if (query) {
    setStatus(`Showing market results for “${query}”`);
  } else {
    setStatus("Showing all market listings");
  }
}

async function start(): Promise<void> {
  try {
    catalog = await loadItemCatalog();

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        openPage(
          (tab.dataset.page ?? "buying") as PageName,
        );
      });
    });

    globalSearch.addEventListener(
      "input",
      renderGlobalSuggestions,
    );

    globalSearch.addEventListener("keydown", (event) => {
      const suggestions = getGlobalSuggestions();

      if (
        event.key === "ArrowDown" &&
        !globalSuggestions.hidden
      ) {
        event.preventDefault();

        selectedGlobalSuggestion = Math.min(
          selectedGlobalSuggestion + 1,
          suggestions.length - 1,
        );

        highlightGlobalSuggestion();
        return;
      }

      if (
        event.key === "ArrowUp" &&
        !globalSuggestions.hidden
      ) {
        event.preventDefault();

        selectedGlobalSuggestion = Math.max(
          selectedGlobalSuggestion - 1,
          0,
        );

        highlightGlobalSuggestion();
        return;
      }

      if (event.key === "Tab" && suggestions.length > 0) {
        event.preventDefault();
        acceptGlobalSuggestion();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        if (
          !globalSuggestions.hidden &&
          selectedGlobalSuggestion >= 0
        ) {
          acceptGlobalSuggestion();
        }

        performGlobalSearch();
        return;
      }

      if (event.key === "Escape") {
        globalSuggestions.hidden = true;
        inlineCompletion.textContent = "";
      }
    });

    globalSearch.addEventListener("blur", () => {
      window.setTimeout(() => {
        globalSuggestions.hidden = true;
      }, 120);
    });

    openPage("buying");

    setStatus(
      `Loaded ${catalog.items.length} Minecraft items`,
    );
  } catch (error) {
    pageContent.innerHTML = `
      <section class="panel">
        <h2>Could not start the calculator</h2>

        <p class="form-error">
          ${
            error instanceof Error
              ? escapeHtml(error.message)
              : "An unknown error occurred."
          }
        </p>
      </section>
    `;

    setStatus("Startup failed");
  }
}

void start();