import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';
import App from './App';

// MapLibre v6 は import.meta.url 基準でワーカーを探すため、Vite のバンドル後は明示的に指定する
setWorkerUrl(maplibreWorkerUrl);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
