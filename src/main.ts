import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="app">
    <header class="topbar">
      <div>
        <h1>Grass Market Calculator</h1>
        <p>Minecraft Java Edition 1.19.2</p>
      </div>

      <input
        class="global-search"
        type="search"
        placeholder="Search items, listings, and recipes..."
      />
    </header>

    <nav class="tabs">
      <button class="tab active" data-page="buying">Buying Items</button>
      <button class="tab" data-page="selling">Selling Items</button>
      <button class="tab" data-page="market">Market Prices</button>
      <button class="tab" data-page="crafting">Crafting</button>
      <button class="tab" data-page="storage">Storage</button>
      <button class="tab" data-page="history">History</button>
    </nav>

    <main class="page">
      <section id="page-content" class="panel">
        <h2>Buying Items</h2>
        <p>Compare listings where you spend grass blocks to receive items.</p>

        <div class="form-row">
          <label>
            Item
            <input type="text" placeholder="Example: Shulker Box" />
          </label>

          <label>
            Listing
            <input type="text" placeholder="Example: 4 for 11g" />
          </label>

          <button class="primary-button">Add listing</button>
        </div>

        <div class="empty-state">
          No buying listings have been added yet.
        </div>
      </section>
    </main>

    <footer class="statusbar">
      Ready
    </footer>
  </div>
`;

const pageContent = document.querySelector<HTMLElement>("#page-content")!;
const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");

const pages: Record<string, { title: string; description: string }> = {
  buying: {
    title: "Buying Items",
    description: "Compare listings where you spend grass blocks to receive items.",
  },
  selling: {
    title: "Selling Items",
    description: "Compare listings where you receive grass blocks for selling items.",
  },
  market: {
    title: "Market Prices",
    description: "View buying and selling listings in one place.",
  },
  crafting: {
    title: "Crafting",
    description: "Compare buying items against crafting them.",
  },
  storage: {
    title: "Storage",
    description: "Track the items and quantities you currently own.",
  },
  history: {
    title: "History",
    description: "Review previous prices and listing changes.",
  },
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((otherTab) => otherTab.classList.remove("active"));
    tab.classList.add("active");

    const pageName = tab.dataset.page ?? "buying";
    const page = pages[pageName];

    pageContent.innerHTML = `
      <h2>${page.title}</h2>
      <p>${page.description}</p>

      <div class="empty-state">
        The ${page.title} page is ready to be built.
      </div>
    `;
  });
});