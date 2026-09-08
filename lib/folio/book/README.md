# Folio閲覧部品

添付 `folio-book.zip` の `folio-book.js` をベースにしています。原文の説明は `REFERENCE.md` に残しています。56分割の曲面投影・表裏の切替・表紙からのセンタリング・位置/速度による完了判定・850ms基準の補間を維持しました。

## 接続

- `components/folio/Reader.tsx`: クライアント側だけで部品を読み込み、既存 `PageCanvas` を紙面画像に変換して渡します。
- `content.ts`: 写真Blobの読込とフォントを待ち、写真・テキスト・ステッカー・落書き・紙を端末内でCanvasに変換。めくり中はDOMを再生成しません。
- `folio-book.js`: Shadow DOM内の閲覧UIとCanvas描画。`setContent()`がFolio用の追加APIです。バインダーは綴じ代・4穴と金具を投影します。

## 内容の差し替え

通常はFolioの編集画面で表紙・各ページを編集するだけです。次に閲覧すると保存された最新版を反映します。`coverPageId` が表紙、`pageOrder`の残りがP1、P2…です。P1が表紙の裏面で、最初の見開きはP1/P2。本文が奇数なら末尾だけ白紙で補完します。

画像から直接組み立てたい場合、読み込み済み画像を700×980のCanvasに描いて以下を渡せます。

```ts
book.setContent({
  title: 'My Folio',
  bookType: 'book', // または binder
  cover: coverCanvas,
  pages: [
    { texture: page1Canvas, title: '1ページ', body: '読み上げ用の説明' },
    { texture: page2Canvas, title: '2ページ', body: '読み上げ用の説明' },
  ],
});
```

`setContent`は表紙と本文を一括差し替え、閉じた状態へ戻します。従来の `pages`（テキスト/画像URL）APIも残しています。`nextPage`・`previousPage`・`currentSpread`・`pagechange` は参考実装と同じです。矢印キーは冊子にフォーカスがある時だけ有効です。

Canvas閲覧では文字選択はできません。写真は外部へ送信せず、IndexedDBのデータ構造や編集機能は変更していません。最大15ページの紙面画像をメモリに持ち、閲覧を閉じると解放します。
