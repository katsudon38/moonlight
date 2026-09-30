import type { MapLayer } from '../types';

const SOURCE_LABEL: Record<MapLayer['source'], string> = {
  tile: 'タイル',
  wms: 'WMS',
  geojson: 'GeoJSON',
  shapefile: 'SHP',
};

interface Props {
  layers: MapLayer[];
  onChange: (id: string, patch: Partial<MapLayer>) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onRemove: (id: string) => void;
  onZoomTo: (layer: MapLayer) => void;
}

export default function LayerList({ layers, onChange, onMove, onRemove, onZoomTo }: Props) {
  return (
    <section className="panel">
      <h2>レイヤ</h2>
      {layers.length === 0 && <p className="muted">レイヤがありません。下のフォームから追加してください。</p>}
      <ul className="layer-list">
        {layers.map((layer, i) => (
          <li key={layer.id} className="layer-item">
            <div className="layer-row">
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={(e) => onChange(layer.id, { visible: e.target.checked })}
                title="表示/非表示"
              />
              {layer.type === 'vector' && (
                <input
                  type="color"
                  value={layer.color}
                  onChange={(e) => onChange(layer.id, { color: e.target.value })}
                  title="色"
                />
              )}
              <span className="badge">{SOURCE_LABEL[layer.source]}</span>
              <input
                className="layer-name"
                value={layer.name}
                onChange={(e) => onChange(layer.id, { name: e.target.value })}
              />
            </div>
            <div className="layer-row">
              <label className="opacity">
                透過度
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={layer.opacity}
                  onChange={(e) => onChange(layer.id, { opacity: Number(e.target.value) })}
                />
                <span className="num">{Math.round(layer.opacity * 100)}%</span>
              </label>
              <div className="buttons">
                <button onClick={() => onMove(layer.id, -1)} disabled={i === 0} title="上へ">▲</button>
                <button onClick={() => onMove(layer.id, 1)} disabled={i === layers.length - 1} title="下へ">▼</button>
                {layer.type === 'vector' && (
                  <button onClick={() => onZoomTo(layer)} title="範囲にズーム">⌖</button>
                )}
                <button onClick={() => onRemove(layer.id)} title="削除" className="danger">✕</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">OpenStreetMap（ベース）</p>
    </section>
  );
}
