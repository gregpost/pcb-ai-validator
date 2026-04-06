// sidebar.ts - Collapsible sidebar widget for the main application
// Provides a container for various widgets and handles collapse logic.

export class Sidebar {
  public el: HTMLDivElement;
  private content!: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'sidebar';
    this.init();
  }
  private init(): void {
    const h = document.createElement('div');
    h.className = 'sidebar-header';
    const c = document.createElement('span');
    c.className = 'close-btn';
    c.innerHTML = '&times;';
    c.onclick = () => this.toggle();
    h.appendChild(c);
    this.el.appendChild(h);
    this.content = document.createElement('div');
    this.content.className = 'sidebar-content';
    this.el.appendChild(this.content);
    document.body.appendChild(this.el);
  }
  public addWidget(w: HTMLElement): void { this.content.appendChild(w); }
  public toggle(): void { this.el.classList.toggle('collapsed'); }
}
(window as any).Sidebar = Sidebar;
