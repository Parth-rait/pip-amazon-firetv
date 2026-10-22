// Entry point of the Command Center (hub.html, served at /hub on this machine).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/pip.css';
import './hub.css';
import { HubApp } from './HubApp';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <HubApp />
    </StrictMode>,
  );
}
