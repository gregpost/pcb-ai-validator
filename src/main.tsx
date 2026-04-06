// file: src/main.tsx
// Entry point for the React application using Vite

import React from 'react'; // React
import ReactDOM from 'react-dom/client'; // ReactDOM
import App from './App'; // App
import './index.css'; // index.css

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
