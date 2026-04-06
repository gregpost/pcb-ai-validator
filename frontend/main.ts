// frontend/main.ts - Main entry point for the frontend application
// Initializes the Sidebar and FileDialog widgets.

import { Sidebar } from './sidebar/sidebar';
import { FileDialog } from './sidebar/file_dialog/file_dialog';

function init() {
  const sidebar = new Sidebar();
  const fileDialog = new FileDialog();
  sidebar.addWidget(fileDialog.el);
  sidebar.toggle(); // Start collapsed

  // Expose sidebar to window for the toggle button in HTML
  (window as any).sidebar = sidebar;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
