import type { Feature, FeatureCollection, GeoJSON, Position } from 'geojson';
import shp from 'shpjs';
import type { RasterLayer, VectorLayer } from '../types';

const PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324'];
let seq = 0;

export function newId(): string {
  seq += 1;
  return `layer-${Date.now().toString(36)}-${seq}`;
}

function nextColor(): string {
  return PALETTE[seq % PALETTE.length];
}

/** `{s}` を a/b/c に展開する（MapLibre は `{s}` 非対応のため） */
function expandSubdomains(url: string): string[] {
  return url.includes('{s}') ? ['a', 'b', 'c'].map((s) => url.replace('{s}', s)) : [url];
}

export function createTileLayer(url: string, name?: string, tileSize = 256): RasterLayer {
  const trimmed = url.trim();
  if (!/\{z\}/.test(trimmed) || !/\{x\}/.test(trimmed) || !/\{y\}/.test(trimmed)) {
    throw new Error('URL に {z}/{x}/{y} を含めてください');
  }
  return {
    id: newId(),
    name: name?.trim() || hostOf(trimmed),
    type: 'raster',
    source: 'tile',
    tiles: expandSubdomains(trimmed),
    tileSize,
    visible: true,
    opacity: 1,
  };
}

export interface WmsOptions {
  url: string;
  layers: string;
  version: '1.1.1' | '1.3.0';
  format: string;
  styles?: string;
  name?: string;
}

export function buildWmsTileUrl(o: WmsOptions): string {
  const base = o.url.trim().replace(/[?&]+$/, '');
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: o.version,
    REQUEST: 'GetMap',
    LAYERS: o.layers,
    STYLES: o.styles ?? '',
    FORMAT: o.format,
    TRANSPARENT: 'true',
    WIDTH: '256',
    HEIGHT: '256',
    [o.version === '1.3.0' ? 'CRS' : 'SRS']: 'EPSG:3857',
  });
  // {bbox-epsg-3857} はエンコードされないよう後から連結する
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${params.toString()}&BBOX={bbox-epsg-3857}`;
}

export function createWmsLayer(o: WmsOptions): RasterLayer {
  if (!o.url.trim()) throw new Error('WMS の URL を入力してください');
  if (!o.layers.trim()) throw new Error('LAYERS を入力してください');
  return {
    id: newId(),
    name: o.name?.trim() || `WMS: ${o.layers}`,
    type: 'raster',
    source: 'wms',
    tiles: [buildWmsTileUrl(o)],
    tileSize: 256,
    visible: true,
    opacity: 1,
  };
}

export interface WmsLayerInfo {
  name: string;
  title: string;
}

/** GetCapabilities からレイヤ一覧を取得する（CORS が許可されているサーバのみ） */
export async function fetchWmsCapabilities(url: string, version: string): Promise<WmsLayerInfo[]> {
  const base = url.trim().replace(/[?&]+$/, '');
  const sep = base.includes('?') ? '&' : '?';
  const res = await fetch(`${base}${sep}SERVICE=WMS&REQUEST=GetCapabilities&VERSION=${version}`);
  if (!res.ok) throw new Error(`GetCapabilities 失敗: HTTP ${res.status}`);
  const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
  const result: WmsLayerInfo[] = [];
  for (const el of Array.from(xml.getElementsByTagName('Layer'))) {
    const nameEl = Array.from(el.children).find((c) => c.localName === 'Name');
    if (!nameEl?.textContent) continue;
    const titleEl = Array.from(el.children).find((c) => c.localName === 'Title');
    result.push({ name: nameEl.textContent, title: titleEl?.textContent || nameEl.textContent });
  }
  return result;
}

/** 任意の GeoJSON を FeatureCollection に正規化する */
export function toFeatureCollection(input: GeoJSON): FeatureCollection {
  switch (input.type) {
    case 'FeatureCollection':
      return input;
    case 'Feature':
      return { type: 'FeatureCollection', features: [input] };
    default:
      return {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: input, properties: {} } as Feature],
      };
  }
}

export function createGeoJsonLayer(text: string, name?: string): VectorLayer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON の解析に失敗しました: ${(e as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
    throw new Error('GeoJSON ではありません（type プロパティがありません）');
  }
  return vectorLayer(toFeatureCollection(parsed as GeoJSON), name?.trim() || 'GeoJSON', 'geojson');
}

function vectorLayer(data: FeatureCollection, name: string, source: VectorLayer['source']): VectorLayer {
  return {
    id: newId(),
    name,
    type: 'vector',
    source,
    data,
    color: nextColor(),
    visible: true,
    opacity: 1,
  };
}

/**
 * シェイプファイルを読み込む。
 * - .zip 1 つ（複数 shp を含んでも可）
 * - .shp（必須）+ .dbf / .prj / .cpg（任意）を同時選択
 */
export async function createShapefileLayers(files: File[]): Promise<VectorLayer[]> {
  const byExt = new Map<string, File>();
  for (const f of files) byExt.set(f.name.split('.').pop()!.toLowerCase(), f);

  const zip = byExt.get('zip');
  if (zip) {
    const result = await shp(await zip.arrayBuffer());
    const list = Array.isArray(result) ? result : [result];
    const baseName = zip.name.replace(/\.zip$/i, '');
    return list.map((fc) => vectorLayer(fc, fc.fileName || baseName, 'shapefile'));
  }

  const shpFile = byExt.get('shp');
  if (!shpFile) throw new Error('.zip または .shp ファイルを選択してください');
  const result = await shp({
    shp: await shpFile.arrayBuffer(),
    dbf: await byExt.get('dbf')?.arrayBuffer(),
    prj: await byExt.get('prj')?.text(),
    cpg: await byExt.get('cpg')?.text(),
  });
  const fc = Array.isArray(result) ? result[0] : result;
  return [vectorLayer(fc, shpFile.name.replace(/\.shp$/i, ''), 'shapefile')];
}

export function bboxOf(fc: FeatureCollection): [number, number, number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number') {
      const [x, y] = c as Position;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      return;
    }
    c.forEach(visit);
  };
  const visitGeom = (g: Feature['geometry']): void => {
    if (!g) return;
    if (g.type === 'GeometryCollection') g.geometries.forEach(visitGeom);
    else visit(g.coordinates);
  };
  fc.features.forEach((f) => visitGeom(f.geometry));
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

function hostOf(url: string): string {
  try {
    return new URL(url.replace(/\{[^}]+\}/g, '0')).host;
  } catch {
    return 'タイル';
  }
}
