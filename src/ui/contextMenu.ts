export interface ContextMenuItem {
    label?: string;
    icon?: string;
    danger?: boolean;
    separator?: boolean;
    action?: () => void;
  }
  
  let activeMenu: HTMLElement | null = null;
  
  export function closeContextMenu(): void {
    activeMenu?.remove();
    activeMenu = null;
  }
  
  export function showContextMenu(
    x: number,
    y: number,
    items: ContextMenuItem[],
  ): void {
    closeContextMenu();
  
    const menu = document.createElement("div");
    menu.className = "context-menu";
  
    for (const item of items) {
      if (item.separator) {
        const separator = document.createElement("div");
        separator.className = "context-menu-separator";
        menu.append(separator);
        continue;
      }
  
      const button = document.createElement("button");
      button.type = "button";
      button.className = "context-menu-item";
  
      if (item.danger) {
        button.classList.add("danger");
      }
  
      button.innerHTML = `
        <span class="context-menu-icon">
          ${item.icon ?? ""}
        </span>
  
        <span>${item.label ?? ""}</span>
      `;
  
      button.addEventListener("click", () => {
        closeContextMenu();
        item.action?.();
      });
  
      menu.append(button);
    }
  
    document.body.append(menu);
    activeMenu = menu;
  
    const rect = menu.getBoundingClientRect();
  
    const adjustedX = Math.min(
      x,
      window.innerWidth - rect.width - 8,
    );
  
    const adjustedY = Math.min(
      y,
      window.innerHeight - rect.height - 8,
    );
  
    menu.style.left = `${Math.max(8, adjustedX)}px`;
    menu.style.top = `${Math.max(8, adjustedY)}px`;
  }
  
  document.addEventListener("mousedown", (event) => {
    if (
      activeMenu &&
      !activeMenu.contains(event.target as Node)
    ) {
      closeContextMenu();
    }
  });
  
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeContextMenu();
    }
  });
  
  window.addEventListener("blur", closeContextMenu);
  window.addEventListener("resize", closeContextMenu);