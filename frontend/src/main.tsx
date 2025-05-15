// ==== File: frontend/src/main.tsx ====
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css'; // Ensure this path is correct
import App from './App'; // Ensure this path is correct

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Root container missing from HTML (expected #root)");
}