import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

import App from './App';
import './styles/globals.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1A1A1A',
          color: '#FFFFFF',
          border: '1px solid #2A2A2A',
        },
        success: {
          iconTheme: {
            primary: '#00D26A',
            secondary: '#FFFFFF',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  </React.StrictMode>
);
