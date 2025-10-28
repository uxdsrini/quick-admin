import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { suppressBlinkIframeErrors, suppressDataCloneErrors } from './utils/errorSuppression';

// Suppress Blink iframe monitoring errors and DataCloneError that don't affect app functionality
suppressBlinkIframeErrors();
suppressDataCloneErrors();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
