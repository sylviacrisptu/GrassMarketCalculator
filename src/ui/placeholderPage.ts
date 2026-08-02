interface PlaceholderPageOptions {
    eyebrow: string;
    title: string;
    description: string;
    message: string;
  }
  
  export function renderPlaceholderPage(
    container: HTMLElement,
    options: PlaceholderPageOptions,
  ): void {
    container.innerHTML = `
      <section class="page-header">
        <div>
          <span class="page-eyebrow">${options.eyebrow}</span>
          <h2>${options.title}</h2>
          <p>${options.description}</p>
        </div>
      </section>
  
      <section class="content-card placeholder-card">
        <div class="placeholder-icon">◇</div>
        <h3>${options.title}</h3>
        <p>${options.message}</p>
      </section>
    `;
  }