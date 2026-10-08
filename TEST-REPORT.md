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

## 1.2.21 — 2026-10-07 JST

ユーザーから「打音に限らずほぼ生に反応し、上限近くのときだけ少し抑える」と指定があり、1.2.20の持続音20%制限と打音の選別を撤廃。カバーは音量とスペクトルの変化の連続入力を使います。上限の80%以下は線形で、上限近辺だけソフトに制限し、300ms以上続く場合に上側の余裕を少し縮めます。

40件のNodeテスト、型検証、配布ビルド成功。旧方式の7テストは、持続音の即時反応・通常域の線形性・上限近辺のみの抑制・リセットを確認する4テストへ置き換えました。登録3曲の現行版の合格判定は引き続き未完了です。1.2.20でNOCTURNALの0:54–0:58をDOMから観測し、拡大と赤い光の変化を確認しましたが、これは今回の方式の合格証拠にはしません。

CIで以前からlockfileのhar-formatのバージョンと実際のパッケージに不一致があることを検出。npm公式レジストリの1.2.16へ戻しました。ローカルキャッシュだけでは不一致を発見できず、CIの新規取得で発見しました。

1.2.21のローカルブラウザ合成入力では、持続音で1.06倍、スペクトル変化で1.09倍、強い入力で約1.1499倍、強い入力の継続で約1.1379倍を確認。弱い入力と無音への復帰も成功しました。GitHub側の新規依存取得・型検証・40テスト・パッケージ生成も成功。アカウントのArtifact容量上限でアップロードが失敗したため、CIは検証と配布ビルドに限定し、ZIPのアップロードを除きました。既存Artifactの削除や課金変更は行っていません。

## 1.2.22 — 2026-10-07 JST

「上限付近では縮めるより細かい変化で揺れてほしい」という指定に合わせ、時間経過による上限抑制を撤廃。通常域は生入力に比例し、上限付近では直近500msの平均に対する増減を拡大の細かな動きへ変換します。一定入力で人工的に揺らす処理はありません。テストは一定の強い入力で縮まないこと、上限付近の小さな増減が見えること、通常域へ戻ることを確認します。実曲での現行版確認は未完了です。

## 1.2.23 — 2026-10-07 JST

画面のゆらぎはランダムな地点を約5秒で結ぶ連続曲線へ変更。bassOnsetで移動を加速し、約20msで速度を上げて約350msの減衰で通常の速さへ戻します。キックは同じ経路の速度を変え、位置を飛ばしません。スライダー最大で各方向約14px。停止時の復帰とReduced Motionに対応。

移動用CSS変数をdocumentルートからSoundSkyホストとQueueへ限定。Queue自身のstyle更新では行の位置確認を繰り返さず、揺れによる毎フレームのMutationObserver処理を除きました。実曲・実機での滑らかさの再確認は未完了です。

型検証、43件のNodeテスト、配布ビルド成功。ローカルブラウザではキックによる経路の加速、画面サイズ変更後のQueue一致、Reduced Motion、停止時の復帰、閉じた後の解除を確認しました。

## 1.2.24 — 2026-10-07 JST

背景・Paper背景・ベールを画面の外側24pxまで拡張し、CSSフォールバックも既存の余白に24pxを追加。最大14pxの移動でも背景端を露出させないよう変更。ランダム経路の地点間は、共有する速度・加速度を持つ5次曲線でつなぎ、切り替え時の加速度の段差を解消しました。描画範囲内に収まるよう地点の範囲も調整。

型検証、44件のNodeテスト、配布ビルド成功。地点前後の速度・加速度の連続性を検証しました。

ローカルブラウザでデスクトップと390px幅の背景4層が、各方向±14pxへ動かしても画面全体を覆うことを確認。キック加速、Queue一致、停止、Reduced Motion、終了時の解除も成功しました。

## 1.2.25 — 2026-10-08 JST

カバーの40×40画像から主要な異なる色を最大3色抽出し、暗い4色の配色として公式MeshGradientへ渡します。単色・同系色の陰影・白黒・透明・画像なし・取得失敗では既存の配色を使用。既存のアクセント用画像取得と共用し、追加の画像リクエストを作りません。約900msの色相遷移で色を移し、Reduced Motionでは即座に適用します。背景の音反応は維持し、GemSmokeとHeatmapの配色は変更していません。

47件のNodeテスト、型検証、配布ビルド成功。ローカルブラウザで、検証用の赤・シアン画像の抽出色がMeshGradientのuniformへ到達し、単色画像への変更で既存配色へ戻ることを確認。実SoundCloudの多様なジャケットでの見た目の確認は未完了です。


## 1.3.1 — 2026-10-08 JST

通常のSoundCloud画面を整えるテーマを追加（初期オフ）。現在のカバーからアクセントとMeshGradientの配色を引き継ぎ、非表示・Reduced Motion・SoundSky表示中は通常画面のシェーダーを停止。ページ用iframeにはテーマのみを適用する。

ユーザーが読み込んだ1.3.0のDiscover実画面を確認。1680pxの画面でコンテナ1240px、下部操作部48pxだったため、1100px以上では左右40pxの余白・最大1760pxへ変更し、メインと360pxのサイドバーを連動させた。操作部は72px、再生ボタン40px。ジャケットの内側のみホバー時に3.5%拡大し、Reduced Motionでは即座に停止。全ボタンへの箱の装飾、曲行への余分な上下パディング、全画像への角丸を取り除いた。

1.3.0で発生したpostMessageのopaque originエラーを修正。準備メッセージを受けたフレームのみ登録し、送信直前に実際のoriginを確認する。null origin・他オリジンへの遷移・削除されたフレームには送らない。再注入時はフレームのstorage listenerも解除する。

51件のNodeテスト、型検証、配布ビルド成功。ローカルブラウザでは通常テーマのオン／オフと保存、現在曲アクセント、シェーダー描画、ネイティブ再生操作、iframeへのテーマ反映、390pxの設定幅を確認。実画面で観測した構造を用いたローカル検証で1680/1280pxの横幅、サイドバーとの重なりなし、操作部72px、ホバーとReduced Motion、オフ時の48px復帰を確認。これらのローカル検証は更新後の実SoundCloud全ページ確認を代替しない。1.3.1の実画面確認はリロード待ち。


1.3.1リロード後の実Discover画面で、コンテナ1600px・左右40px・メイン1240px・サイドバー360px・操作部72px・再生ボタン40px・背景canvasを確認。ネイティブgalleryの208px固定高により、広がったジャケットの下のタイトルが切れる問題を発見した。1.3.2ではgalleryと内部の高さをコンテンツに合わせ、操作部の元の灰色背景レイヤーも透明に変更。1.3.2の実画面再確認待ち。

キューボタンは24pxのborder-boxに左右12pxずつのpaddingが入り、16pxのSVGの右端がボタンの外へ出ていた。操作部のアイコンのpaddingを取り、右側の3操作を32px幅・36px高・4px間隔に揃えた。曲情報の幅を280〜400pxで確保し、シークバーにmin-width:0を指定。1680/1280pxのローカル検証でキューSVGがボタン内・操作部内に収まり、galleryのタイトルが表示領域内に収まることを確認。既存の設定と画面のゆらぎのブラウザ検証も成功。


## 1.3.3 — 2026-10-08 JST

1.3.2の実Discover画面で、キューボタン32×36pxと16pxのSVGが操作部内に収まり、クリックでQueueが画面内に開くことを確認。元の灰色レイヤーも透明になった。一方でgalleryのcaptionがまだ切れていた。実DOMでsliderPanelのmax-height:208pxを確認し、height:autoだけでは解除できないことが分かった。1.3.3でgallery各層のmax-heightも解除した。ローカル検証の構造に同じ最大高さを追加し、1680/1280pxでcaptionが表示領域内に収まることを確認。型検証・配布ビルド成功。実ページの最終確認はリロード待ち。
