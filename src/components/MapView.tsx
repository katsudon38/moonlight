import { useEffect, useRef, useState } from 'react';
import {
  Map as MlMap,
  NavigationControl,
  Popup,
  ScaleControl,
  type ExpressionSpecification,
  type MapMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import type { MapLayer } from '../types';

const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

/** MapLibre 上で 1 つのユーザレイヤを構成するサブレイヤ ID（下から順） */
function subLayerIds(layer: MapLayer): string[] {
  return layer.type === 'raster'
    ? [layer.id]
    : [`${layer.id}-fill`, `${layer.id}-line`, `${layer.id}-circle`];
}

/** Multi* ジオメトリも含めて型判定するフィルタ式 */
function isType(...types: ('Point' | 'LineString' | 'Polygon')[]): ExpressionSpecification {
  return ['in', ['geometry-type'], ['literal', types.flatMap((t) => [t, `Multi${t}`])]];
}

function addLayer(map: MlMap, layer: MapLayer): void {
  if (layer.type === 'raster') {
    map.addSource(layer.id, {
      type: 'raster',
      tiles: layer.tiles,
      tileSize: layer.tileSize,
      attribution: layer.attribution,
    });
    map.addLayer({ id: layer.id, type: 'raster', source: layer.id });
    return;
  }
  map.addSource(layer.id, { type: 'geojson', data: layer.data });
  map.addLayer({
    id: `${layer.id}-fill`,
    type: 'fill',
    source: layer.id,
    filter: isType('Polygon'),
  });
  map.addLayer({
    id: `${layer.id}-line`,
    type: 'line',
    source: layer.id,
    filter: isType('Polygon', 'LineString'),
    paint: { 'line-width': 2 },
  });
  map.addLayer({
    id: `${layer.id}-circle`,
    type: 'circle',
    source: layer.id,
    filter: isType('Point'),
    paint: { 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 },
  });
}

function applyStyle(map: MlMap, layer: MapLayer): void {
  const visibility = layer.visible ? 'visible' : 'none';
  for (const id of subLayerIds(layer)) map.setLayoutProperty(id, 'visibility', visibility);

  if (layer.type === 'raster') {
    map.setPaintProperty(layer.id, 'raster-opacity', layer.opacity);
    return;
  }
  const { id, color, opacity } = layer;
  map.setPaintProperty(`${id}-fill`, 'fill-color', color);
  map.setPaintProperty(`${id}-fill`, 'fill-opacity', opacity * 0.35);
  map.setPaintProperty(`${id}-line`, 'line-color', color);
  map.setPaintProperty(`${id}-line`, 'line-opacity', opacity);
  map.setPaintProperty(`${id}-circle`, 'circle-color', color);
  map.setPaintProperty(`${id}-circle`, 'circle-opacity', opacity);
  map.setPaintProperty(`${id}-circle`, 'circle-stroke-opacity', opacity);
}

function removeLayer(map: MlMap, layer: MapLayer): void {
  for (const id of subLayerIds(layer)) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(layer.id)) map.removeSource(layer.id);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

interface Props {
  /** 先頭が最前面 */
  layers: MapLayer[];
  onMapReady?: (map: MlMap) => void;
}

export default function MapView({ layers, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const addedRef = useRef(new Map<string, MapLayer>());
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = new MlMap({
      container: containerRef.current!,
      style: BASE_STYLE,
      center: [139.767, 35.681],
      zoom: 10,
    });
    map.addControl(new NavigationControl(), 'top-right');
    map.addControl(new ScaleControl(), 'bottom-left');

    map.on('load', () => {
      mapRef.current = map;
      setReady(true);
      onMapReady?.(map);
    });

    // ベクタ地物クリックで属性をポップアップ表示
    map.on('click', (e: MapMouseEvent) => {
      const ids = layersRef.current
        .filter((l) => l.type === 'vector' && l.visible)
        .flatMap(subLayerIds)
        .filter((id) => map.getLayer(id));
      if (ids.length === 0) return;
      const feature = map.queryRenderedFeatures(e.point, { layers: ids })[0];
      if (!feature) return;
      const rows = Object.entries(feature.properties ?? {})
        .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(String(v))}</td></tr>`)
        .join('');
      new Popup({ maxWidth: '360px' })
        .setLngLat(e.lngLat)
        .setHTML(rows ? `<table class="props">${rows}</table>` : '<em>属性なし</em>')
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      addedRef.current.clear();
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React 側のレイヤ状態を MapLibre へ同期する
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const added = addedRef.current;
    const currentIds = new Set(layers.map((l) => l.id));

    for (const [id, layer] of added) {
      if (!currentIds.has(id)) {
        removeLayer(map, layer);
        added.delete(id);
      }
    }
    for (const layer of layers) {
      if (!added.has(layer.id)) addLayer(map, layer);
      added.set(layer.id, layer);
      applyStyle(map, layer);
    }
    // 最背面のレイヤから順に最上位へ移動し、配列順（先頭が最前面）に並べる
    for (const layer of [...layers].reverse()) {
      for (const id of subLayerIds(layer)) map.moveLayer(id);
    }
  }, [layers, ready]);

  return <div ref={containerRef} className="map" />;
}
