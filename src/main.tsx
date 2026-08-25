import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

import App from './App';
import { AppProvider } from './store';
import './index.css';

// Новата версия поема сама при следващото отваряне — без бутон „обнови".
registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('Липсва #root в index.html');

createRoot(container).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
