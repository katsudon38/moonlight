import type { FeatureCollection } from 'geojson';

interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  /** 0〜1 */
  opacity: number;
}

/** XYZ タイル・WMS など、ラスタタイルとして描画するレイヤ */
export interface RasterLayer extends LayerBase {
  type: 'raster';
  source: 'tile' | 'wms';
  tiles: string[];
  tileSize: number;
  attribution?: string;
}

/** GeoJSON・シェイプファイルなど、ベクタとして描画するレイヤ */
export interface VectorLayer extends LayerBase {
  type: 'vector';
  source: 'geojson' | 'shapefile';
  data: FeatureCollection;
  color: string;
}

export type MapLayer = RasterLayer | VectorLayer;
