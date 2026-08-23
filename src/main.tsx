import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ThemeRoot from './ThemeRoot';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeRoot />
  </StrictMode>,
);
