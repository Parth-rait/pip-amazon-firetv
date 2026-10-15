// Entry point: mounts the Pip Pad.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { takeCodeFromAddress } from './lib/address';
import './styles/tokens.css';
import './styles/app.css';

// Before the first render, so the join screen and the rejoin both see the link's code.
takeCodeFromAddress();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
