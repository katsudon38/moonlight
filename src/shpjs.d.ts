declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';

  type ShpResult = FeatureCollection & { fileName?: string };
  type ShpInput =
    | string
    | ArrayBuffer
    | ArrayBufferView
    | { shp: ArrayBuffer; dbf?: ArrayBuffer; prj?: ArrayBuffer | string; cpg?: ArrayBuffer | string };

  export default function shp(input: ShpInput): Promise<ShpResult | ShpResult[]>;
}
