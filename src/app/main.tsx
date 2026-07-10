import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root') as HTMLElement;
root.replaceChildren();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
