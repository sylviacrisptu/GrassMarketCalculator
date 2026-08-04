import "./style.css";

import {
  loadItemCatalog,
  searchItems,
  type ItemCatalog,
} from "./data/itemCatalog.ts";
import {
  renderListingPage
} from "./ui/listingPage.ts";
import {
  renderMarketPage
} from "./ui/marketPage.ts";
import {
  renderPreferencesPage,
} from "./ui/preferencesPage.ts";
import {
  renderQuantityCalculatorPage,
} from "./ui/quantityCalculatorPage.ts";
import {
  renderProfitCalculatorPage,
} from "./ui/profitCalculatorPage.ts";
import {
  renderStoragePage,
} from "./ui/storagePage.ts";
import {
  renderCraftingPage,
} from "./ui/craftingPage.ts";

type PageName =
  | "buying"
  | "selling"
  | "market"
  | "crafting"
  | "quantity"
  | "profit"
  | "storage"
  | "preferences";

type ToolPageName = Exclude<PageName, "preferences">;

interface PageDefinition {
  label: string;
}

const pageDefinitions: Record<PageName, PageDefinition> = {
  buying: {
    label: "Buying Items",
  },
  selling: {
    label: "Selling Items",
  },
  market: {
    label: "Market Prices",
  },
  crafting: {
    label: "Crafting",
  },
  quantity: {
    label: "Stack Calculator",
  },
  profit: {
    label: "Profit Calculator",
  },
  storage: {
    label: "Storage",
  },
  preferences: {
    label: "Preferences",
  },
};

const toolPages: ToolPageName[] = [
  "buying",
  "selling",
  "market",
  "crafting",
  "quantity",
  "profit",
  "storage",
];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="app-shell top-shell">
    <div class="application-area">
      <header class="top-application-header">
        <div class="top-brand-search-row">
          <h1 class="application-title">
            Grass Market Calculator
          </h1>

          <div class="header-search-area">
            <div class="global-search-container">
              <div class="global-search-row">
                <div class="global-search-wrapper">
                  <input
                    id="global-search"
                    class="global-search"
                    type="search"
                    autocomplete="off"
                    placeholder="Search items and listings…"
                    aria-label="Search market listings"
                  />

                  <span
                    id="global-inline-completion"
                    class="inline-completion"
                  ></span>

                  <div
                    id="global-suggestions"
                    class="global-suggestions"
                    hidden
                  ></div>
                </div>

                <button
                  id="global-search-button"
                  class="global-search-button"
                  type="button"
                >
                  Search
                </button>
              </div>

              <span class="autocomplete-help">
                Press Tab to autocomplete
              </span>
            </div>
          </div>
        </div>

        <nav class="top-tool-navigation" aria-label="Calculator tools">
          ${toolPages
    .map((page) => {
      const definition = pageDefinitions[page];

      return `
                <button
                  class="top-tool-button"
                  type="button"
                  data-page="${page}"
                >
                  ${definition.label}
                </button>
              `;
    })
    .join("")}
        </nav>
      </header>

      <main id="page-content" class="page-content">
        <section class="content-card">
          Loading Minecraft item catalog…
        </section>
      </main>
    </div>

    <div class="floating-utility-buttons">
      <button
        id="theme-toggle"
        class="floating-utility-button"
        type="button"
        aria-label="Switch theme"
        title="Switch theme"
      >
        <span id="theme-toggle-icon">☾</span>
      </button>

      <a
        class="floating-utility-button"
        href="https://github.com/sylviacrisptu/GrassMarketCalculator/issues"
        target="_blank"
        rel="noreferrer"
        aria-label="Support"
        title="Support"
      >
        ?
      </a>

      <button
        id="preferences-button"
        class="floating-utility-button"
        type="button"
        aria-label="Preferences"
        title="Preferences"
      >
        <span
          class="settings-icon"
          aria-hidden="true"
        ></span>
      </button>
    </div>
  </div>
`

const pageContent =
  document.querySelector<HTMLElement>("#page-content")!;


const toolButtons =
  document.querySelectorAll<HTMLButtonElement>(
    ".top-tool-button",
  );

const preferencesButton =
  document.querySelector<HTMLButtonElement>(
    "#preferences-button",
  )!;

const globalSearch =
  document.querySelector<HTMLInputElement>("#global-search")!;

const globalSearchButton =
  document.querySelector<HTMLButtonElement>(
    "#global-search-button",
  )!;

const globalSuggestions =
  document.querySelector<HTMLDivElement>("#global-suggestions")!;

const inlineCompletion =
  document.querySelector<HTMLSpanElement>(
    "#global-inline-completion",
  )!;

const themeToggle =
  document.querySelector<HTMLButtonElement>("#theme-toggle")!;

const themeToggleIcon =
  document.querySelector<HTMLElement>("#theme-toggle-icon")!;

let cleanupCurrentPage: (() => void) | null = null;
let catalog: ItemCatalog;
let selectedGlobalSuggestion = -1;
let currentPage: PageName = "buying";

function setStatus(_message: string): void {
  // Status messages are intentionally silent in the web layout.
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

  inlineCompletion.textContent = first.slice(typed.length);

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
  const leftPadding =
    Number.parseFloat(computedStyle.paddingLeft) || 14;

  inlineCompletion.style.left =
    `${leftPadding + typedWidth + 2}px`;
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

function openPage(
  page: PageName,
  marketQuery = "",
  profitItem = "",
  pageQuery = "",
): void {
  cleanupCurrentPage?.();
  cleanupCurrentPage = null;
  currentPage = page;

  toolButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === page,
    );
  });

  preferencesButton.classList.toggle(
    "active",
    page === "preferences",
  );

  if (page === "market") {
    cleanupCurrentPage = renderMarketPage(
      pageContent,
      setStatus,
      catalog,
      marketQuery,
    );
  } else if (page === "buying" || page === "selling") {
    cleanupCurrentPage = renderListingPage(pageContent, {
      type: page,
      catalog,
      setStatus,
      initialQuery: pageQuery,
    });
  } else if (page === "quantity") {
    renderQuantityCalculatorPage(pageContent, {
      setStatus,
    });
  } else if (page === "profit") {
    cleanupCurrentPage = renderProfitCalculatorPage(
      pageContent,
      {
        catalog,
        setStatus,
        initialItem: profitItem,
      },
    );
  } else if (page === "storage") {
    cleanupCurrentPage = renderStoragePage(
      pageContent,
      {
        catalog,
        setStatus,
        initialQuery: pageQuery,
      },
    );
  } else if (page === "crafting") {
    cleanupCurrentPage = renderCraftingPage(
      pageContent,
      {
        catalog,
        setStatus,
      },
    );
  } else {
    cleanupCurrentPage = renderPreferencesPage(
      pageContent,
      {
        setStatus,
      },
    );
  }

  setStatus(
    page === "market" && marketQuery
      ? `Searching market for “${marketQuery}”`
      : `Opened ${pageDefinitions[page].label}`,
  );
}

function performGlobalSearch(): void {
  const query = globalSearch.value.trim();

  globalSuggestions.hidden = true;
  inlineCompletion.textContent = "";

  openPage("market", query);

  setStatus(
    query
      ? `Showing market results for “${query}”`
      : "Showing all market listings",
  );
}

type ThemeName = "light" | "dark";

function getSavedTheme(): ThemeName {
  const saved = localStorage.getItem("gmc.theme");

  return saved === "light" ? "light" : "dark";
}

function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("gmc.theme", theme);

  const isDark = theme === "dark";

  themeToggleIcon.textContent = isDark ? "☀" : "☾";
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light theme" : "Switch to dark theme",
  );
  themeToggle.title =
    isDark ? "Light theme" : "Dark theme";
}

async function start(): Promise<void> {
  applyTheme(getSavedTheme());

  try {
    catalog = await loadItemCatalog();

    toolButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const page =
          button.dataset.page as ToolPageName | undefined;

        if (page) {
          openPage(page);
        }
      });
    });

    preferencesButton.addEventListener("click", () => {
      openPage("preferences");
    });

    themeToggle.addEventListener("click", () => {
      const currentTheme =
        document.documentElement.dataset.theme;

      applyTheme(
        currentTheme === "dark" ? "light" : "dark",
      );

      setStatus("Theme changed");
    });

    globalSearchButton.addEventListener(
      "click",
      () => {
        const suggestions = getGlobalSuggestions();

        if (suggestions.length > 0) {
          acceptGlobalSuggestion();
        }

        performGlobalSearch();
      },
    );

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

    window.addEventListener(
      "gmc:navigate-profit",
      (event) => {
        const customEvent =
          event as CustomEvent<{
            item?: string;
          }>;
    
        openPage(
          "profit",
          "",
          customEvent.detail.item ?? "",
        );
      },
    );
    
    window.addEventListener(
      "gmc:navigate-listings",
      (event) => {
        const customEvent =
          event as CustomEvent<{
            type?: "buying" | "selling";
            item?: string;
          }>;
    
        openPage(
          customEvent.detail.type ??
            "buying",
          "",
          "",
          customEvent.detail.item ?? "",
        );
      },
    );
    
    window.addEventListener(
      "gmc:navigate-storage",
      (event) => {
        const customEvent =
          event as CustomEvent<{
            item?: string;
          }>;
    
        openPage(
          "storage",
          "",
          "",
          customEvent.detail.item ?? "",
        );
      },
    );

    openPage(currentPage);

    setStatus(
      `Loaded ${catalog.items.length} Minecraft items`,
    );
  } catch (error) {
    pageContent.innerHTML = `
      <section class="content-card">
        <h2>Could not start the calculator</h2>

        <p class="form-error">
          ${error instanceof Error
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