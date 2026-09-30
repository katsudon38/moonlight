import { useState, type FormEvent } from 'react';
import type { MapLayer } from '../types';
import {
  createGeoJsonLayer,
  createShapefileLayers,
  createTileLayer,
  createWmsLayer,
  fetchWmsCapabilities,
  type WmsLayerInfo,
  type WmsOptions,
} from '../lib/layers';

type Tab = 'tile' | 'geojson' | 'wms' | 'shapefile';

const TABS: { key: Tab; label: string }[] = [
  { key: 'tile', label: 'タイル' },
  { key: 'geojson', label: 'GeoJSON' },
  { key: 'wms', label: 'WMS' },
  { key: 'shapefile', label: 'シェイプ' },
];

interface Props {
  onAdd: (layers: MapLayer[]) => void;
}

export default function AddLayerPanel({ onAdd }: Props) {
  const [tab, setTab] = useState<Tab>('tile');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => MapLayer[] | Promise<MapLayer[]>): Promise<boolean> => {
    setError(null);
    setBusy(true);
    try {
      onAdd(await fn());
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2>レイヤを追加</h2>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => {
              setTab(t.key);
              setError(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'tile' && <TileForm run={run} busy={busy} />}
      {tab === 'geojson' && <GeoJsonForm run={run} busy={busy} />}
      {tab === 'wms' && <WmsForm run={run} busy={busy} />}
      {tab === 'shapefile' && <ShapefileForm run={run} busy={busy} />}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

interface FormProps {
  run: (fn: () => MapLayer[] | Promise<MapLayer[]>) => Promise<boolean>;
  busy: boolean;
}

function TileForm({ run, busy }: FormProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [tileSize, setTileSize] = useState(256);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => [createTileLayer(url, name, tileSize)])) {
      setUrl('');
      setName('');
    }
  };

  return (
    <form onSubmit={submit}>
      <label>
        タイル URL
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
          required
        />
      </label>
      <p className="muted small">{'{z} {x} {y} を含む XYZ 形式。{s} は a/b/c に展開されます。'}</p>
      <label>
        名前（任意）
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        タイルサイズ
        <select value={tileSize} onChange={(e) => setTileSize(Number(e.target.value))}>
          <option value={256}>256</option>
          <option value={512}>512</option>
        </select>
      </label>
      <button type="submit" disabled={busy}>追加</button>
    </form>
  );
}

function GeoJsonForm({ run, busy }: FormProps) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => [createGeoJsonLayer(text, name)])) {
      setText('');
      setName('');
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    void run(() =>
      Promise.all(
        Array.from(files).map(async (f) =>
          createGeoJsonLayer(await f.text(), f.name.replace(/\.(geo)?json$/i, '')),
        ),
      ),
    );
  };

  return (
    <form onSubmit={submit}>
      <label>
        ファイルをアップロード
        <input
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          multiple
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      <p className="muted small">または GeoJSON を貼り付け</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder='{"type":"FeatureCollection","features":[...]}'
      />
      <label>
        名前（任意）
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <button type="submit" disabled={busy || !text.trim()}>貼り付けた内容を追加</button>
    </form>
  );
}

function WmsForm({ run, busy }: FormProps) {
  const [opts, setOpts] = useState<WmsOptions>({
    url: '',
    layers: '',
    version: '1.3.0',
    format: 'image/png',
    styles: '',
    name: '',
  });
  const [capLayers, setCapLayers] = useState<WmsLayerInfo[]>([]);
  const [capMsg, setCapMsg] = useState<string | null>(null);
  const set = (patch: Partial<WmsOptions>) => setOpts((o) => ({ ...o, ...patch }));

  const loadCaps = async () => {
    setCapMsg('取得中…');
    try {
      const list = await fetchWmsCapabilities(opts.url, opts.version);
      setCapLayers(list);
      setCapMsg(list.length ? null : 'レイヤが見つかりませんでした');
    } catch (e) {
      setCapLayers([]);
      setCapMsg(`取得できませんでした（CORS 制限の可能性）。LAYERS を直接入力してください。${(e as Error).message}`);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run(() => [createWmsLayer(opts)]);
  };

  return (
    <form onSubmit={submit}>
      <label>
        WMS エンドポイント URL
        <input
          value={opts.url}
          onChange={(e) => set({ url: e.target.value })}
          placeholder="https://ows.terrestris.de/osm/service"
          required
        />
      </label>
      <label>
        バージョン
        <select value={opts.version} onChange={(e) => set({ version: e.target.value as WmsOptions['version'] })}>
          <option value="1.3.0">1.3.0</option>
          <option value="1.1.1">1.1.1</option>
        </select>
      </label>
      <button type="button" onClick={loadCaps} disabled={!opts.url.trim()}>
        GetCapabilities でレイヤ一覧を取得
      </button>
      {capMsg && <p className="muted small">{capMsg}</p>}
      {capLayers.length > 0 && (
        <label>
          レイヤ選択
          <select value={opts.layers} onChange={(e) => set({ layers: e.target.value, name: e.target.selectedOptions[0]?.text })}>
            <option value="">-- 選択 --</option>
            {capLayers.map((l) => (
              <option key={l.name} value={l.name}>{l.title}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        LAYERS（カンマ区切り）
        <input value={opts.layers} onChange={(e) => set({ layers: e.target.value })} placeholder="OSM-WMS" required />
      </label>
      <label>
        STYLES（任意）
        <input value={opts.styles} onChange={(e) => set({ styles: e.target.value })} />
      </label>
      <label>
        FORMAT
        <select value={opts.format} onChange={(e) => set({ format: e.target.value })}>
          <option value="image/png">image/png</option>
          <option value="image/jpeg">image/jpeg</option>
          <option value="image/webp">image/webp</option>
        </select>
      </label>
      <label>
        名前（任意）
        <input value={opts.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <p className="muted small">EPSG:3857 で GetMap をリクエストします。</p>
      <button type="submit" disabled={busy}>追加</button>
    </form>
  );
}

function ShapefileForm({ run, busy }: FormProps) {
  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    void run(() => createShapefileLayers(Array.from(files)));
  };

  return (
    <div className="form">
      <label>
        シェイプファイルを選択
        <input
          type="file"
          accept=".zip,.shp,.dbf,.prj,.cpg,.shx"
          multiple
          disabled={busy}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      <p className="muted small">
        .zip（複数の shp を含んでも可）、または .shp と .dbf / .prj / .cpg を同時に選択してください。
        .prj があれば WGS84 に座標変換されます。
      </p>
      {busy && <p className="muted small">読み込み中…</p>}
    </div>
  );
}
