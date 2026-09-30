# moonlight — Map Viewer

React + [MapLibre GL JS](https://maplibre.org/) の地図ビューア。ベース地図は OpenStreetMap。

## 起動

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ に出力
```

## 機能

サイドバーの「レイヤを追加」から以下を重ねられます。

| 種類 | 入力方法 |
| --- | --- |
| タイル | `{z}/{x}/{y}` を含む XYZ タイル URL（`{s}` は a/b/c に展開） |
| GeoJSON | ファイルアップロード（複数可）またはテキスト貼り付け |
| WMS | エンドポイント URL + LAYERS。GetCapabilities でレイヤ一覧取得も可（サーバが CORS を許可している場合） |
| シェイプファイル | `.zip`、または `.shp` + `.dbf` / `.prj` / `.cpg` を同時選択。`.prj` があれば WGS84 へ変換 |

レイヤ一覧では以下を操作できます。

- ▲▼ で上下（描画順）の移動（一覧の上が最前面）
- スライダーで透過度の調整
- 表示/非表示、名前変更、削除
- ベクタレイヤ（GeoJSON / シェイプ）は色変更・範囲ズーム・地物クリックで属性表示

## 構成

- `src/components/MapView.tsx` — MapLibre 地図。React のレイヤ状態を MapLibre のソース/レイヤへ同期
- `src/components/LayerList.tsx` — レイヤ一覧（順序・透過度・表示）
- `src/components/AddLayerPanel.tsx` — 追加フォーム（タイル / GeoJSON / WMS / シェイプ）
- `src/lib/layers.ts` — 各入力からレイヤ定義を生成（WMS URL 組み立て、シェイプ解析など）
