// Entry point of the browser TV (tv.html, served at /tv).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/pip.css';
import './tv.css';
import { TvApp } from './TvApp';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <TvApp />
    </StrictMode>,
  );
}
