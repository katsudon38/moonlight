import { useCallback, useRef, useState } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import MapView from './components/MapView';
import LayerList from './components/LayerList';
import AddLayerPanel from './components/AddLayerPanel';
import { bboxOf } from './lib/layers';
import type { MapLayer } from './types';

export default function App() {
  // 先頭が最前面
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const mapRef = useRef<MlMap | null>(null);

  const zoomTo = useCallback((layer: MapLayer) => {
    if (layer.type !== 'vector' || !mapRef.current) return;
    const bbox = bboxOf(layer.data);
    if (bbox) mapRef.current.fitBounds(bbox, { padding: 40, maxZoom: 16 });
  }, []);

  const addLayers = useCallback(
    (added: MapLayer[]) => {
      setLayers((prev) => [...[...added].reverse(), ...prev]);
      const firstVector = added.find((l) => l.type === 'vector');
      if (firstVector) zoomTo(firstVector);
    },
    [zoomTo],
  );

  const updateLayer = useCallback((id: string, patch: Partial<MapLayer>) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? ({ ...l, ...patch } as MapLayer) : l)));
  }, []);

  const moveLayer = useCallback((id: string, delta: -1 | 1) => {
    setLayers((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const removeLayer = useCallback((id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Map Viewer</h1>
        <LayerList
          layers={layers}
          onChange={updateLayer}
          onMove={moveLayer}
          onRemove={removeLayer}
          onZoomTo={zoomTo}
        />
        <AddLayerPanel onAdd={addLayers} />
      </aside>
      <MapView layers={layers} onMapReady={(m) => (mapRef.current = m)} />
    </div>
  );
}
