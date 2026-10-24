import './styles/app.css';
import { App } from './app';
import { isNative } from './platform';

new App();

// Offline support for the web build. The Android app ships its files locally and needs no worker.
if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
