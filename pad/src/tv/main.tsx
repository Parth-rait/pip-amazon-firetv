// Entry point of the TV simulator (Virtual Pip Lab). Not the Vega app: a browser stand-in that
// speaks the same protocol, so the TV experience can be seen and tested without a Fire TV.
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
