import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Remove the service worker registration code
// Delete everything between the "// Register service worker" comment and the root.render line

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
