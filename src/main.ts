import "./style.css";

import {
  loadItemCatalog,
  searchItems,
  type ItemCatalog,
} from "./data/itemCatalog.ts";
import { renderListingPage } from "./ui/listingPage.ts";
import { renderMarketPage } from "./ui/marketPage.ts";
import { renderPlaceholderPage } from "./ui/placeholderPage.ts";

type PageName =
  | "buying"
  | "selling"
  | "market"
  | "crafting"
  | "storage"
  | "history"
  | "preferences";

interface PageDefinition {
  label: string;
  icon: string;
}

const pageDefinitions: Record<PageName, PageDefinition> = {
  buying: {
    label: "Buying Items",
    icon: "↓",
  },
  selling: {
    label: "Selling Items",
    icon: "↑",
  },
  market: {
    label: "Market Prices",
    icon: "≡",
  },
  crafting: {
    label: "Crafting",
    icon: "◆",
  },
  storage: {
    label: "Storage",
    icon: "□",
  },
  history: {
    label: "History",
    icon: "◷",
  },
  preferences: {
    label: "Preferences",
    icon: "⚙",
  },
};

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="app-shell">
    <aside id="sidebar" class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-mark">G</div>

        <div class="brand-copy">
          <strong>Grass Market</strong>
          <span>Calculator</span>
        </div>

        <button
          id="close-sidebar"
          class="icon-button close-sidebar-button"
          type="button"
          aria-label="Close navigation"
        >
          ×
        </button>
      </div>

      <nav class="sidebar-navigation" aria-label="Main navigation">
        ${Object.entries(pageDefinitions)
          .map(
            ([page, definition]) => `
              <button
                class="sidebar-link"
                type="button"
                data-page="${page}"
              >
                <span class="sidebar-link-icon">
                  ${definition.icon}
                </span>

                <span>${definition.label}</span>
              </button>
            `,
          )
          .join("")}
      </nav>

      <div class="sidebar-footer">
        <button
          id="theme-toggle"
          class="sidebar-secondary-button"
          type="button"
        >
          <span id="theme-toggle-icon">☾</span>
          <span id="theme-toggle-label">Dark theme</span>
        </button>

        <a
          class="sidebar-secondary-button"
          href="https://github.com/sylviacrisptu/GrassMarketCalculator/issues"
          target="_blank"
          rel="noreferrer"
        >
          <span>?</span>
          <span>Support</span>
        </a>

        <div class="version-label">
          Web preview · Minecraft 1.19.2
        </div>
      </div>
    </aside>

    <div id="sidebar-overlay" class="sidebar-overlay"></div>

    <div class="application-area">
      <header class="application-header">
        <button
          id="open-sidebar"
          class="icon-button mobile-menu-button"
          type="button"
          aria-label="Open navigation"
        >
          ☰
        </button>

        <div class="header-title">
          <span id="header-eyebrow">Market workspace</span>
          <strong id="header-page-title">Buying Items</strong>
        </div>

        <div class="header-search-area">
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

            <span class="autocomplete-help">
              Press Tab to autocomplete
            </span>
          </div>
        </div>
      </header>

      <main id="page-content" class="page-content">
        <section class="content-card">
          Loading Minecraft item catalog…
        </section>
      </main>

      <footer class="application-statusbar">
        <span id="statusbar">Starting…</span>

        <span class="status-indicator">
          <span class="status-dot"></span>
          Saved locally
        </span>
      </footer>
    </div>
  </div>
`;

const pageContent =
  document.querySelector<HTMLElement>("#page-content")!;

const statusbar =
  document.querySelector<HTMLElement>("#statusbar")!;

const sidebar =
  document.querySelector<HTMLElement>("#sidebar")!;

const sidebarOverlay =
  document.querySelector<HTMLElement>("#sidebar-overlay")!;

const openSidebarButton =
  document.querySelector<HTMLButtonElement>("#open-sidebar")!;

const closeSidebarButton =
  document.querySelector<HTMLButtonElement>("#close-sidebar")!;

const sidebarLinks =
  document.querySelectorAll<HTMLButtonElement>(".sidebar-link");

const headerPageTitle =
  document.querySelector<HTMLElement>("#header-page-title")!;

const globalSearch =
  document.querySelector<HTMLInputElement>("#global-search")!;

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

const themeToggleLabel =
  document.querySelector<HTMLElement>("#theme-toggle-label")!;

let cleanupCurrentPage: (() => void) | null = null;
let catalog: ItemCatalog;
let selectedGlobalSuggestion = -1;
let currentPage: PageName = "buying";

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

function closeMobileSidebar(): void {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("visible");
}

function openMobileSidebar(): void {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("visible");
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

function renderPlaceholder(page: PageName): void {
  if (page === "crafting") {
    renderPlaceholderPage(pageContent, {
      eyebrow: "Recipe planning",
      title: "Crafting",
      description:
        "Compare market prices with complete crafting paths.",
      message:
        "The interactive crafting tree and recipe estimator will be added here.",
    });

    return;
  }

  if (page === "storage") {
    renderPlaceholderPage(pageContent, {
      eyebrow: "Owned inventory",
      title: "Storage",
      description:
        "Track items you already own and use them in calculations.",
      message:
        "Storage quantities, icons, favorites, and stack conversions will be added here.",
    });

    return;
  }

  if (page === "history") {
    renderPlaceholderPage(pageContent, {
      eyebrow: "Market records",
      title: "History",
      description:
        "Review previous prices and changes to saved listings.",
      message:
        "Price history, charts, filters, and restoration tools will be added here.",
    });

    return;
  }

  renderPlaceholderPage(pageContent, {
    eyebrow: "Application customization",
    title: "Preferences",
    description:
      "Manage themes, icons, backups, data, and accessibility.",
    message:
      "Theme editing and application preferences will be added here.",
  });
}

function openPage(
  page: PageName,
  marketQuery = "",
): void {
  cleanupCurrentPage?.();
  cleanupCurrentPage = null;
  currentPage = page;

  sidebarLinks.forEach((link) => {
    link.classList.toggle(
      "active",
      link.dataset.page === page,
    );
  });

  headerPageTitle.textContent = pageDefinitions[page].label;

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
    });
  } else {
    renderPlaceholder(page);
  }

  closeMobileSidebar();

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
  return localStorage.getItem("gmc.theme") === "dark"
    ? "dark"
    : "light";
}

function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("gmc.theme", theme);

  const isDark = theme === "dark";

  themeToggleIcon.textContent = isDark ? "☀" : "☾";
  themeToggleLabel.textContent =
    isDark ? "Light theme" : "Dark theme";
}

async function start(): Promise<void> {
  applyTheme(getSavedTheme());

  try {
    catalog = await loadItemCatalog();

    sidebarLinks.forEach((link) => {
      link.addEventListener("click", () => {
        const page = link.dataset.page as PageName | undefined;

        if (page) {
          openPage(page);
        }
      });
    });

    openSidebarButton.addEventListener(
      "click",
      openMobileSidebar,
    );

    closeSidebarButton.addEventListener(
      "click",
      closeMobileSidebar,
    );

    sidebarOverlay.addEventListener(
      "click",
      closeMobileSidebar,
    );

    themeToggle.addEventListener("click", () => {
      const currentTheme =
        document.documentElement.dataset.theme;

      applyTheme(
        currentTheme === "dark" ? "light" : "dark",
      );

      setStatus("Theme changed");
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

    openPage(currentPage);

    setStatus(
      `Loaded ${catalog.items.length} Minecraft items`,
    );
  } catch (error) {
    pageContent.innerHTML = `
      <section class="content-card">
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