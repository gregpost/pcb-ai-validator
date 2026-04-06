// file_dialog.ts - File selection widget for the sidebar
// Handles file input and validation for specific extensions.

export class FileDialog {
  public el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'file-dialog';
    this.init();
  }
  private init(): void {
    const l = document.createElement('label');
    l.innerText = 'Файлы (pdf, txt, md, PcbDoc):';
    const i = document.createElement('input');
    i.type = 'file';
    i.multiple = true;
    i.accept = '.pdf,.txt,.md,.PcbDoc';
    this.el.appendChild(l);
    this.el.appendChild(i);
  }
}
(window as any).FileDialog = FileDialog;
