# SoundSky 検証記録

2026-10-04。仕様から新規実装。既存のSoundSky実装はありませんでした。

## 完了した確認

- `npm test`: 12件。現在曲と現在アーティストの限定、別の曲のボタンの拒否、非同期処理中の曲変更、非破壊のRepost状態取得、メニュー所有関係、曲変更中のシーク拒否、欠損プレイヤー、URLの検証、再生UIルート交換、開閉・再注入時のリソース解放。
- `npm run check`: TypeScript型検証。
- `npm run build`: 読み込み用のManifest V3ビルド。
- ローカル検証画面で再生・一時停止、曲変更、シーク、音量のUIとネイティブ操作対象の状態が一致することを確認。
- 1280×720、1440×900、2560×1080、900×480、390×660のサイズを持つ検証用iframeでレイアウトを確認。長い曲名でもQueueと下部操作部の領域を維持。
- Queueなし・ジャケットなしをローカル画面で確認。
- 開閉を12回繰り返した後もインスタンス数が1。再注入時も1。終了後にObserver、タイマー、スタイルが残らないことを自動テストで確認。
- ローカル画面の継続的なConsoleエラーなし。

## 修正して再確認した問題

- 背景のはみ出しがhiddenスクロール領域を作り、操作後に表示が78pxずれた。`overflow: clip` に変更し、ずれが0になったことを確認。
- SoundCloudのQueue親要素にtransformがあり、固定配置の基準が変わる。SoundSkyを開いている時だけ、該当する親のtransformを解除するCSSを追加。
- 狭い画面で補助表示が消えると再生ボタンが左へ寄った。中央カラムを明示し、390px画面で再生ボタン中心が195pxになることを確認。
- 曲情報の初期取得前にRepost状態を読んだ場合、初回の状態更新でキャッシュが消えた。現在曲のIDが一致するキャッシュを保つよう修正し、テストを追加。
- モバイル幅で戻るボタンの文字を隠すとAccessible Nameが変わった。明示的なARIAラベルを追加。

## 実SoundCloudの事前調査

ログイン済みChromeのSoundCloudで、現在曲専用の下部プレイヤー、Like、Follow、進捗、音量、Queue、現在項目、AutoPlayのチェック状態、現在項目が所有するMore/Repostメニューを読み取りました。SoundCloud本体の再生・一時停止とSPAの曲ページへの移動を確認しました。Like・Repost・Followのアカウント状態は変更していません。

## 拡張機能を読み込んだ実ページでの検証（継続中）

ユーザーによる導入後、実SoundCloudでSoundSkyの起動、ジャケット・曲名・アーティストの一致、Play/Pause、シークのネイティブ進捗への反映を確認しました。AutoPlayがオンの実Queue、現在曲の識別、Like/Repost/Followの状態と現在曲への限定を読み取りました。アカウント状態は変更していません。

実環境で以下の問題を発見し、修正版をdistへビルドしました。修正版の再読み込み後の実ページ検証は未完了です。

- ネイティブQueueの非表示ヘッダーの60pxオフセットが残る。スクロール領域のtopを0に指定。
- 最後の現在曲を上端へスクロールできない。仮想行の56px寸法を維持し、末尾に表示領域分の余白を追加。
- 閉じたネイティブ音量パネルの高さが0となり、下限の操作値がずれる。SoundSky表示中のラッパー高さを固定。
- 所有関係を確認したRepostメニューがSoundSkyのクリック伝播で閉じる可能性がある。Shadow内のボタンクリックの伝播を停止。
- AutoPlayトグルのオレンジ色が疑似要素に残る。疑似要素とハンドルを統一色に変更。

12件の自動テスト、型検証、ビルドは修正後も成功しています。Next/Previous、AutoPlayによる終了時の曲変更、SPA遷移、修正版の音量・キュー・Repost表示、Action/ショートカット、実ページのリサイズ・Console確認を引き続き検証する必要があります。**製品の完了条件を満たしたとは扱っていません。**

ブラウザー操作ツールのURLポリシーによりChrome内部の拡張機能画面を操作できないため、修正版の拡張機能リロードとSoundCloudページのリロードをユーザーへ依頼しています。

## Paper Mesh Gradient（追加検証）

`@paper-design/shaders@0.0.81` の実際のMesh Gradientフラグメントをシークバーへ同梱。Apache-2.0 LICENSE/NOTICEを配布物へ収録。従来の独自オーロラ式は削除。

Chromeのローカル検証画面でWebGL2コンパイル成功、Canvasが非表示フォールバックへ落ちていないこと、1024×12内部解像度を確認。時間を空けたスクリーンショットのバー領域8400ピクセルすべてが変化し、色の流動を確認。シークのEnd/Homeで100%/0%のクリップと現在時間が同期。型検証・12件のテスト・配布ビルドも成功。修正版を読み込んだ実SoundCloudの確認は引き続き必要。

オーディオビジュアライザーは任意提案として検討中。音声解析の接続を確認していないため、このビルドには未実装。


## 1.1.0 verification — 2026-10-06 JST

- TypeScript check and 15 Node tests passed, including parallel Web Audio analysis/output preservation, current artist badge fallback, repost reprobe, stale identity refusal, and observer/timer teardown.
- Actual SoundCloud DOM was inspected in Chromium. Reproduced an enabled Follow button being blocked by `.playControls__queue` intercepting pointer events. Restricted native pointer hit testing to the queue itself; a real browser click then reached SoundCloud's Follow handler and opened its authentication UI.
- Repost also opened the verified current queue item’s native menu after a browser click (captured in `output/playwright/live-repost.png`). The verification browser was signed out. Account-level follow/repost state changes in a signed-in session have not been verified.
- SoundCloud Web Audio playback produced a nonzero measured RMS peak (0.56) through the new page-world analysis branch. This is actual stream analysis, not a timed synthetic pulse.
- Local fixture verification: official Paper effects compile/render; canvas sizing checked inside Shadow DOM; volume native state changes on `input`, before release. Screenshots are under `output/playwright/`.
- Upgrade requires reloading the extension and the SoundCloud tab, because the page-world audio hook must load before SoundCloud constructs its graph.

## 1.1.2 verification — 2026-10-06 JST

- Heatmap now uses a filled cover-sized mask and covers the artwork surface with screen blending; the outline mask and external frame are removed. Inspected `output/playwright/heat-cover-surface.png`.
- Browser telemetry injection (test inputs, not actual audio) confirmed both official mounts use exact speeds: RMS .1 → 1.1, .4 → 2.6, 2 → 10.6, 0 → .6. This verifies direct linear response without smoothing, normalization, compression or a speed ceiling.
- TypeScript check, existing 15 tests and distribution packaging passed.

## 1.2.0 verification — 2026-10-06 JST

- TypeScript check and 19 tests passed. New detector tests cover frequency attacks at unchanged RMS, sample-rate independence, preservation of volume differences, silence and first-frame initialization.
- Browser test inputs held RMS at .4 and changed onset from 0 to .5: shader speed changed from 2.6 to 8.6, and artwork scale from approximately 1.0023 to 1.0265. These are controlled inputs; actual mastered-track response still depends on its spectral content.
- Computed styles confirmed Heatmap opacity 1, backing layer 0, artwork layer 1, and approximately 24 px backing padding. SVG alpha mask with difference blending was visually inspected for the transport symbol.
- Screenshot: `output/playwright/opaque-heatmap-inverted-glyph.png`.
- Analysis research and implementation choices: `AUDIO-NOTES.md`.


## 1.2.2 — 2026-10-06 JST

Heatmap padding reduced to 6–10 px (about 8 px on a typical desktop). Added a hollow 0.6 px black outline around the inverted transport glyph. Tests and browser verification were skipped for these two adjustments at the user’s explicit request; distribution build completed.


## 1.2.4 — 2026-10-06 JST

Added a top-down hot-color reveal driven by raw loudness over the opaque blue Heatmap base. Artwork scaling now affects only the artwork, with a maximum 5.5% expansion and stronger transient response. Heatmap size remains fixed. No tests or browser verification were run for these changes at the user’s explicit request; distribution build completed.

## 1.2.19 / 1.2.20 — 2026-10-07 JST

販売ロードマップの最初の安定化作業。音声解析の再注入と複数出力・部分切断を改善し、保存設定の型・有限値・範囲を検証。生成済みdistとZIPの残存ファイルを防ぐビルド方式、GitHub Actions、1.2.18の内部比較画像を追加しました。

- 1.2.20: TypeScript検証、43件のNodeテスト、配布パッケージ生成が成功。
- 1.2.19ローカルブラウザ: 日本語設定、個別リセット、保存、無効化、390px幅のレイアウト、公式Heatmapのフラグメント一致、空色の速度維持、赤い光の反応、カバー拡大によるHeatmap位置の不変を確認。
- 画面のゆらぎ: 初期オフ、最大横2px・縦1.2px、Queueの位置一致（デスクトップ・390px幅）、Reduced Motion、停止後の復帰、閉じた後の後片付けを1.2.19で確認。
- 実ブラウザのOfflineAudioContextで左右別の4096サンプルを生成し、解析枝の有無で全8192サンプルが完全一致。これはローカルWeb Audioの検証で、実SoundCloudの音源出力比較ではありません。
- 1.2.20カバーの合成入力: 持続音で約1.021倍、打音で約1.092倍、その後は穏やかな持続音の拡大へ戻り、無音で元に戻ることを確認。持続音の持ち上がりは上限の20%まで。以前の打音のみの方式はsupersaw等の厚い持続音にもすぐ戻ってしまうという報告に合わせて変更しました。
- ユーザー提供3曲は `docs/verification/tracks.json` に登録。更新後の実Chromeで日本語設定の画面が読み込まれたことを確認。1.2.20の実曲検証は未完了で、登録曲を合格扱いにしていません。

未完了: 3曲の現行版での反応、30曲・連続90分、広告と曲間、OS/GPU差、性能計測、ベータ、商用条件確認。販売準備完了とは扱いません。
