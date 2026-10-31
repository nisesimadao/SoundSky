# SoundSky 検証記録

## 1.3.34 — 2026-10-31、再生要求の失敗後の復元

- playが拒否された後も効果終了まで速度・音程補正が変わったままになる問題と、ネイティブplayの同期例外で後片付けが行われない問題を回帰テストで再現。失敗した試行が所有する効果だけを直ちに復元し、元のPromiseと例外を維持する。
- 遅れた古い拒否通知と、新しい再生要求・成功した再生の競合を検証。新しい要求が同じ補間処理を共有する場合も、古い要求の後片付けは実行しない。
- 実ChromeではNotSupportedErrorの直後もpaused=falseだった。停止フラグによる条件判定を廃し、試行と効果の両方の所有関係で復元する。無効な音声データでの検証ボタンを `/audio-lifecycle` に追加。外部通信やスピーカーへの出力はない。
- 1.3.34の実Chromeで10回すべてNotSupportedError、paused=falseのままで、速度・音程補正の即時復元と音量・ミュートの維持を確認。これはローカルの無効な音声データでの検証であり、実SoundCloudの再生要求・自動再生権限・macOSメディア操作は未確認。
- 193件の自動テスト、型検証、検証付き配布ZIP生成が成功。
- 参照仕様: [HTML Standard — play](https://html.spec.whatwg.org/multipage/media.html#dom-media-play)。ネイティブplayの拒否理由と戻り値を維持する。

## 1.3.33 — 2026-10-31、本体XHRの観測と先読みの復帰

- ネイティブsendが同期例外になると本体通信カウンターが残る問題と、通信中のXHRをopenで再利用すると終了イベントなしで観測が残る問題を回帰テストで再現。通信ごとの解放処理を導入し、終了・中止・再利用・送信失敗で一度だけ解放する。失敗したopenでは元の通信を維持する。
- 二重送信と完了後のsendはネイティブのInvalidStateErrorを維持。破棄時はSoundSkyの監視を解除し、本体の進行中の通信は中止しない。
- 実Chromeの検証ページは `npm run dev` の `/prefetch-lifecycle`。通信先だけをローカルへ向けた実XMLHttpRequestと、キャッシュ応答の実Blob通信で確認する。実SoundCloudの通信やmacOS操作の代替ではない。
- 実Chromeの1.3.33で、2本の同時通信、二重送信、再利用、失敗したopen、中止、キャッシュ済みの応答内容・URL、破棄後の本体通信完了を確認。さらに100回の中断・再利用後の残存監視は0。188件の自動テスト、型検証、検証付き配布ZIP生成が成功。
- 参照仕様: [XMLHttpRequest Standard](https://xhr.spec.whatwg.org/#the-send()-method)。ネイティブ自身の状態検証と例外を変更しない。

## 1.3.32 — 2026-10-31、失敗した先読みの情報解放

- 曲の先読みが連続して失敗すると、形式情報が曲数に応じて蓄積する問題を回帰テストで再現（2曲目で不要な記録が残る）。現在曲・次の曲・再利用可能なキャッシュが必要とする情報だけを保持するよう修正。350曲連続失敗でも形式情報は次の1曲分に収まり、既存のメタデータ上限300件も維持する。
- キャッシュ済みの曲が現在曲へ進んだ時は形式情報と音声を維持し、期限切れ後に不要となった形式情報を解放するテストを追加。
- 183件の自動テスト、型検証、検証付き配布ZIP生成が成功。
- 実SoundCloudの設定画面は引き続き1.3.27と確認。最新版の実機検証として扱わない。macOS操作UIへの接続はtimeoutReached、Finderの状態取得はcgWindowNotFoundで失敗し、実OS操作は実施できていない。拡張機能管理画面の制限回避は行っていない。

## 1.3.31 — 2026-10-31、音声解析の失敗隔離と音声資源の解放

- 解析ノードのdisconnectが失敗すると、成功しているネイティブのdisconnectも例外になることを回帰テストで再現した。解析側の後片付けを失敗隔離し、元の接続・切断の結果とネイティブ自身の例外は維持する。解析値の読み取り失敗はそのサンプルだけ無音値とし、ループが停止せず次のサンプルで回復する。
- 音声解析とレコード効果にAudioLifetimeを導入。音源のended、AudioContextのclosedで参照とイベント監視を解放し、描画フレームが配信されない間も後片付けを行う。即時停止・破棄でも監視を解除し、効果が所有していた音程を復元する。2,000コンテキストの生成・閉鎖の模擬テストで監視が残らないことを確認。
- ローカルChromeの実OfflineAudioContextで200回の生成・レンダリング・終了を実行した。解析の有効／無効を切り替え、nativeの音声出力を全サンプルとRMSで比較。さらに監視中のグラフからSoundSkyを破棄した後に1回レンダリングし、出力と元のAPI関数の復元を確認した。
- v1.3.31で201件すべての波形が一致（最大サンプル誤差1.7582432246254776e-9、許容1e-6）、終了後の監視0、破棄後の監視0、監視のピーク3、Consoleエラーなし。これは実ブラウザーの短い合成音による確認であり、実SoundCloudの長時間再生や実macOSメディア操作を代替しない。
- 181件の自動テスト、型検証、検証付き配布ZIP生成が成功。検証ページは `npm run dev` の `/audio-lifecycle` で再実行できる。別ポートの例は `SOUNDSKY_DEV_PORT=4186 npm run dev`。
- 参照したAPIの仕様: [AudioContext.close](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/close)、[BaseAudioContext.statechange](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/statechange_event)。閉鎖だけではJS側の参照が自動的に解放されないため、所有する参照と監視を明示的に解放する。


## 1.3.30 — 2026-10-31、同時保存・キーボード・起動の品質改善

- 保存をworkerで直列化し、変更項目の差分と保存版を使用。別タブの同時編集、古い返信が最後に到着するケース、返信待ち中の再編集、保存失敗後の別タブ更新と再試行、初回読込中の外部更新を、実際のworker／クライアントのコードを組み合わせて検証。
- ビルドをstagingで生成・検証してから差し替え、失敗時の旧版復元と、復元失敗時のバックアップ保持を追加。配布ZIPのファイル一覧・バージョン・必須資産・ライセンス・各ファイルの実データを照合してから出力先ZIPを置き換える。失敗時に旧ビルド／ZIPが残ることを一時ディレクトリー上の実ファイルで検証。
- ローカルChromeで、390px幅の設定からTabが背面の曲名へ移る問題を再現。設定が画面を覆う場合は見えているヘッダーと設定を巡回するよう修正。iframeからのTab／Shift+Tabを親の巡回に接続し、ラジオグループ・無効／非表示の項目・正のtabindexを考慮。
- iframeから戻る時のwindow.focusでネイティブの状態確認クリックが発生し、設定外クリックとして設定が閉じる問題を修正。内部的なクリックでは設定を閉じない。ローカルChromeでShift+TabはSoundCloud設定タブ、Tabはヘッダーの設定ボタンへ戻り、設定が開いたままであることを確認。
- 再生バーの入口が画面外でもfloating launcherが隠れる問題をローカルChromeで再現。交差・表示・viewportを観測して入口を切り替える。390pxで浮動ボタンから開閉でき、通常幅では再生バーへ戻ることを確認。Consoleエラーなし。
- 172件の自動テスト・型検証・検証付き配布パッケージ生成が成功。ビルド差し替え改善と同時保存改善のコミットはGitHub CIでも成功。リリース対象コミットのCI結果はGitHubのChecksで確認する。
- READMEの通信・保存説明を実装と照合し、先読みの追加API通信とタブ内メモリでの認可情報の扱いを明記。実環境・長時間利用・読み上げ環境で残る確認は [COMMERCIAL-READINESS.md](COMMERCIAL-READINESS.md) に記録。商用品質の達成はまだ未証明。


## 1.3.27 — 2026-10-31、既存タブの起動と設定の読み込み

- 起動時に画面の版を確認し、未導入・旧版ならMAINの音声ブリッジ、ISOLATEDの画面の順で復旧する。連打の開閉をタブごとに直列化し、失敗時は再読み込み案内、成功時はバッジと説明を復元する。
- worker・画面・音声ブリッジ・設定のバージョン表示をpackage.jsonの版へ統一し、manifestとの一致をテスト。
- 停止中の微小なシーク・短い巻き戻しをネイティブの位置へ反映。再生／一時停止の端数維持の回帰テストも通過。
- SoundCloud設定iframeの読み込み中・15秒以上の待機・エラーを表示し、同じ枠での再試行と別タブの導線を追加。待機中はフォームを自動で破棄しない。iframe内のEscapeを親の設定閉じる操作へ接続し、ネイティブのダイアログが処理済みの場合は優先する。再読み込みと破棄で監視・キー操作・タイマーを解放する。
- 155件の自動テスト、型検証、配布ZIP生成が成功。ZIP内のSTART-HERE.txtを確認。
- ローカルChromeで「SoundSky / 1.3.27」の表示、設定iframeのready状態、Light追従、iframe内のEscapeで設定が閉じてボタンへフォーカスが戻ること、親URLと再生状態の維持、Consoleエラーなしを確認。
- 実SoundCloudでは読み込み済みの旧UIの入口・Light追従・全画面起動を確認。配布ファイルの更新だけでは新しいUIにならなかった。拡張機能管理画面はブラウザーURLポリシーでブロックされたため、その操作の回避は行っていない。新ビルドの実ページ検証・実macOSメディアUI・長時間再生は、ユーザーによる拡張機能とSoundCloudの再読み込み後に残る。


## 1.3.26 — 2026-10-31、公開前の操作と設定の整理

- 設定を「再生・見た目・サイト・SoundCloud設定」の4分類へ整理。先読み・カバー反応・背景・操作部の細部は折りたたみ、保存済みの調整値を維持。通常設定ページのSoundSky項目も同じ分類と折りたたみをSoundCloudのフォームクラスで描画する。
- 設定や再生以外のボタン上のSpaceが、再生ショートカットへ渡る問題を修正。折りたたみのSpace、設定を閉じるボタン、無効なレコード速度、タブ非表示時の操作状態解放を調整。
- 保存を直列化し、初回読み込みとユーザー操作の競合を修正。読み込み中の全リセット、保存失敗と再試行、別タブからの変更、破棄中の未完了読み込みをテスト。保存失敗は設定画面にも表示。
- 自動テスト145件・型検証・配布パッケージ生成が成功。macOSのメディア操作・背景タブのレコード完了・速度復元は既存の模擬MediaSession／Web Audio回帰テストを含む。
- 通常設定ページで値とステータスを毎回書き直す再描画ループを修正。ローカルChromeで設定変更・数値表示の更新・Consoleエラーなしを確認し、更新が収束する回帰テストを追加。
- ローカルChromeで、設定の4分類、折りたたみのSpaceで再生状態が変わらないこと、Spaceによる設定の閉じる操作、保存と別タブ反映を確認。
- ローカルの設定iframeのLight切り替えでURLを変えず配色が追従し、Next Upの背景が透明、選択肢の背景が白になることを確認。390×660の設定パネル・項目の横幅は390pxで横はみ出しなし。
- 実SoundCloudでの新ビルド、実際のmacOSメディアUIからの操作、長時間再生・実ユーザーの継続利用は未確認。ローカルの設定iframeは本家の保存処理の検証を代替しない。販売可能という判定はまだ行っていない。
- [BETA-TEST.md](BETA-TEST.md) に公開前の実環境検証と1週間の継続利用の手順を用意。参加者への募集・連絡・公開は行っていない。


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


ユーザーの1.3.3リロード後、実Discover画面で先頭3つのgalleryのcaption下端がsliderの表示領域内に収まること、sliderPanelのmax-heightがnoneであることを確認。スクリーンショットでもMixの説明が切れずに表示されることを確認。操作部72px、キューボタン32px、ミックス画像のホバー用transition 280msが読み込まれていることを確認。1.3.3のコードコミットd37c057に対するGitHub Checks（型検証、51件のテスト、配布ビルド）は成功。今回の実画面確認はDiscoverに限定し、全ページの検証完了を意味しない。


## 1.3.5 — 2026-10-09 JST

SoundSkyの入口を通常の下部操作部の右端へ移動。操作部がない時だけ従来の入口を表示する。通常テーマのオン時は共通icons.tsのアイコン、同じPaper LiquidMetalの再生ボタン、MeshGradientの再生済み部分を追加。元のボタンとイベントハンドラー、ARIA属性は維持する。ネイティブの再生位置を基準に更新間を最大1.25秒補間し、停止・シーク・曲変更は取得した位置へ合わせる。ドラッグ中は補間のCSSを外す。通常テーマでの再生中も並列の解析枝を使い、金属とシークバーへ音量を反映する。非表示・停止・ミュート・テーマオフ・破棄時は解析を停止する。

アルバム列はネイティブの横スクロールへ変更。既存の矢印はscrollByへ接続し、暗い円と影を付ける。タッチパッドの横スクロールを利用し、通常の縦スクロールは変換しない。テーマオフでスクロール位置と矢印のdisabled状態を復元する。Artist Toolsはcredit-trackerという名称の同サイト埋め込みだったため、そのMUIの背景面を透明・統一配色へ変更し、追加シェーダーを作らない。Next Upのqueue__itemWrapperに残る#121212を解除。アーティストの丸い画像は50%に統一。実アーティストページでヘッダーの画像面だけ旧幅だったことを確認し、ヘッダー全体に画像を合わせて角丸と余白を整えた。

1.3.4の実画面で2つの不具合を確認。SoundSky表示中も、Queue表示用の高いz-indexを持つnative rootにテーマの背景とbackdrop-filter:blur(20px)が残り、SoundSkyの操作部を覆っていた。1.3.5でSoundSky表示中のnative rootとinnerを透明・ぼかしなしへ固定。通常画面ではネイティブのspanへのmargin-left:8pxとSVG/pathの色・strokeの指定が新しい装飾にも当たり、金属面とマークがずれ、pauseマークが消えていた。所有する装飾に限定して余白と描画属性をリセットし、前後・shuffle・repeatのボタン寸法と間隔を揃えた。

53件のNodeテスト、型検証、配布ビルド成功。ローカルブラウザで入口の配置と重複なし、旧入口の非表示、元のPlay/Pauseハンドラー、pause glyph、金属とシークのcanvas、ネイティブ更新間の進捗変化、停止中の位置維持、ドラッグ中の補間解除、テーマオフ時の復帰を確認。SoundSky表示中のnative背景とblurが消えることも確認。ネイティブの8pxの余白とpathの色・stroke上書きを再現して検証。横スクロール・矢印・影・縦スクロール維持・オフ時の復帰と、Artist Tools埋め込みの透明背景・追加canvasなしもローカル確認。1.3.5の実画面確認はリロード待ち。


## 1.3.6 — 2026-10-09 JST

1.3.5の実DOMでshuffle/repeatのwrapperに装飾していたことを確認。buttonに装飾を移し、元のマークを隠す。通常画面の再生ボタンのborderとinsetの光を削除。Next Up内部の背景を透明に揃え、外側を#20262bedに変更。選択行はradius 0とinset 2pxの一本の線とする。

カバーは新しい画像の読み込み後に480msで上下方向へ交代し、曲名とアーティスト名は280msで表示。世代番号で古い読み込みを拒否し、アニメーションのキャンセル、非表示・閉じる・破棄・reduced motionの後始末を追加。Next Upは実際の表示位置順で可視行のみ35msずつ遅らせ、340msで表示。translateプロパティを使い、仮想リストのtransformや配置を変更しない。両画面で実施。

シークシェーダーの設定をseek-material.tsに集約。通常の再生済み部分に全幅のシェーダーを保持してクリップし、5pxの線・9pxのハンドル・同じアクセントとリングに揃える。ドラッグとテーマオフ時は所有する補間変数を解除する。

WebGL警告の対策として埋め込みページの追加背景を廃止。Paperのunmount後に所有するコンテキストへWEBGL_lose_contextを適用。独自背景の破棄とHeatmapオフも解放対象。ローカル実ブラウザでコンテキストの参照を意図的に保持したままテーマを8回切り替え、累計22コンテキスト生成後に稼働中6、SoundSky破棄後0を確認。Too many active WebGL contexts警告なし。通常の埋め込みとArtist Toolsの追加背景canvasなし、テーマとアクセントの継承・解除も確認。

53件のNodeテスト、型検証、ビルド成功。ローカルブラウザでカバーの上下方向、遅い読み込み中の表示維持、連続曲変更、遅い旧画像による上書き拒否、reduced motion、ランタイムエラーなしを確認。両画面のNext Upで順番の遅延と、通常画面の選択行の角なし・縦線を確認。シークの幅・高さ・ハンドル、shuffle/repeatの二重描画なし、再生ボタンborderなし、元の再生操作・進捗補間・停止・ドラッグ・テーマ解除も確認。ユーザーの実SoundCloudページへの1.3.6適用と再検証はリロード後に行う。


## 1.3.7 — 設定画面の余白

設定パネルを380pxから560pxへ拡幅。左右32pxの余白、44px以上のカテゴリタブ、12pxの説明文、14pxの項目名、項目ごとの余白を調整。600px以下では左右20pxと3列2段のカテゴリタブへ切り替える。ローカル実ブラウザで1680×780、1280×720、390×844、320×640の全5カテゴリを確認し、パネルが画面内に収まること、横のはみ出しとタブ文字の切れがないことを確認。デスクトップのスライダー幅494px。既存の設定ブラウザ検証で個別リセット、保存、無効化、モバイル表示が成功。スクリーンショットで拡幅と説明文の余白も確認。型検証と配布ビルド成功。実SoundCloudへの適用は拡張機能・ページの再読み込み後。


## 1.3.8 — 横スクロールと通常操作部

実DiscoverのDOMで、10枚・20枚の列は最初の5枠だけ内容があり、それ以降が空のlazy slotだったことを確認。1.3.5で矢印のネイティブイベントまで停止していたため、先のアルバムを表示する処理を止めていた。SoundCloudの矢印イベントを維持しながらネイティブ横スクロールを使用するように変更。タッチパッドで空の枠が表示範囲に入る時は、同じネイティブのforward処理を呼ぶ。表示範囲に必要な分を読み込み、処理が進まない場合の繰り返しを抑える。実画面でテーマを一時的に解除してネイティブのforwardを確認し、5枠から9枠へ内容が増え、panelにtranslate3dが設定されることを確認。確認後にテーマを元のオン状態へ復元した。

通常シークの実DOMでは、ノブにmargin-top:-3pxが残り、線の中心より3px上にあった。所有するスタイルでmargin-top:0へ固定。再生ボタンは通常のsc-button-play指定により背景がアクセント色になっていたため、操作部の所有するplayControlに限定して通常・hover・active・focus・playing・選択状態の背景と金属面を固定。

ローカル実ブラウザで20枠中5枠だけ初期表示するgalleryを再現し、末尾へスクロールするとネイティブのイベントで20枠が埋まり、末尾の空白に止まらないことを確認。既存の横ホイール・矢印・影・縦スクロール維持・テーマ解除の検証も成功。実際と同じ絶対配置とmargin-top:-3pxを持つシークで線とノブの中心一致を確認。再生ボタンのクリックとSpace操作で金属の背景色が維持されることも確認。53件のNodeテスト、型検証、配布ビルド成功。新ビルドの実SoundCloud確認は再読み込み後。


## 1.3.9 — 通常シークの中央揃えとフレームAPI

1.3.8の実Artist Studioでシーク枠のcomputed paddingが12px 0、実際の高さが48pxであることを確認。24px指定だけでは元のパディングとflexのstretchが残り、線とノブの中心が操作部の中心より12px上になっていた。枠をborder-box・padding 0・align-self centerにし、timelineもalign-items centerに変更。ノブ単体だけを見ていた前回の検証を補い、48pxのtimelineと上下12pxのネイティブpaddingをローカルで再現して、枠が24pxかつ線・ノブ・timelineの中心が一致することを確認。

再生ボタンは所有する金属面をz-index 1、canvasを0、アイコンを2へ明示。押下・focus・playingでも同じ金属面を保ち、WebGLが利用できない場合の土台もSoundSkyと同じ金属グラデーションとする。ローカルでクリックとSpace操作後の重なり順と、実WebGL描画ピクセルの明暗差を確認し、単色の灰色でなく金属の描画が残ることを検証。

theme-frameの保存APIを存在確認とtry/catchで扱い、APIなしでも親からのテーマメッセージを受け取れるようにした。破棄は二重呼び出しと拡張機能再読み込み時のAPI無効化にも対応。chrome自体がないiframeとstorageがないiframeを再現する2件のテストを追加し、親のテーマ・アクセント継承、追加canvasなし、安全な破棄を確認。55件のNodeテスト、型検証、配布ビルド、通常操作部のローカルブラウザ検証成功。実ページへの新ビルド適用は再読み込み後。


## 1.3.10 — 2026-10-10 JST、通常ページのカバー反応

実曲ページのDOMを確認し、新しい曲ページは/n/で始まる同一サイトのiframe内にTrack headerというregionを持ち、カバーはartworks-の画像として描画されていることを確認。親のネイティブプレイヤーの曲リンクには?in=アーティスト/sets/プレイリストという実際の再生元が含まれていた。ページURLと現在の曲・再生元を照合して、大きなカバー枠だけにCoverPulseを適用。埋め込みページには既存の確認済み同一オリジンフレームの経路で状態・設定・音量とonsetを送信し、各フレームに音声解析やWebGLを追加しない。

拡大上限・感度・20msの上昇／45msの下降はSoundSkyと共通。ノーマライズや打音だけのゲートを追加しない。scaleを使用して元のtransformとレイアウトを維持し、角丸も幅と拡大率から更新。inline styleとpriorityを保存・復元し、停止・ミュート・テーマオフ・ページ変更・非表示・reduced motion・SoundSky表示・破棄に対応。

3件の単体テストを追加し、連続音の反応、停止・ミュート・オフ・破棄、同じ曲を含む別プレイリストへの不反応、modern frameのカバー枠とアバターの区別、元のinline priorityの復元を確認。58件のNodeテストと型検証が成功。ブラウザのSoundCloud模擬ページで音量.2・onset 0を与え、トップページとiframeの両方でscale 1.06を確認。200px枠の角丸9.6px、300px枠の角丸11.4px。親からフレームへの状態・音の転送、停止時にscale 1へ戻ること、別のプレイリストには反応しないこと、実際の再生元のプレイリストは反応すること、reduced motionとSoundSky表示で復元すること、ランタイムエラーなしを確認。新ビルドの実曲による適用確認は再読み込み後。

## 1.3.11 — 2026-10-10 JST、一覧のカバー反応と金属の継続

ユーザーの意図を曲ページの大きなカバーだけと解釈していた1.3.10を修正。実タグ一覧でsound__artwork内のsound__coverArtリンクと背景画像、実ホームでplayableTile__artwork内のプレイリストリンクと画像、実プレイリストでタイトルリンクと兄弟位置にあるtrackItem__imageの構造を確認。現在の曲・再生元のリンクを照合し、これらのカバーを複数同時に対象とする。ホームのin_system_playlistを/discover/sets/の再生元へ対応付ける。遅延追加にも追従し、対象外になったカバーのinline styleとpriorityを復元する。modern headerの画像には読み込み用の兄弟overlayがあるため、子要素数で画像へ切り替えるのをやめ、クリップする画像枠を拡大する。

通常の再生ボタンは金属のsurfaceを保持して、ネイティブDOM更新時にMutationObserverで描画前に再装着する。ボタン内部・ボタン全体が更新されてもReact rootとcanvasを再作成せず、停止はspeed 0、再開は同じシェーダーの続きとなる。アクセント色の上書き防止を所有属性に依存しないネイティブplayControlのセレクターにも適用。

61件のNodeテスト、型検証、配布ビルド成功。ローカルブラウザで、タグ・ホームの同じ曲のカードと再生元アルバム、プレイリスト内の兄弟画像、システムプレイリストの照合、親からiframeへの音の転送、停止・reduced motion・SoundSky表示時の復元、エラーなしを検証。生の音量.2とonset 0でscale 1.06。ボタンの内部と全体の再生成を再現し、クリック／Spaceでも同じcanvasとPaper mount、9000ms以上の時間位置を保持し、更新直後の背景が金属グラデーションのままなことを確認。既存のシーク中央揃え・進捗補間・ドラッグ・テーマ解除の検証も成功。

新ビルドをユーザーのChrome拡張機能に適用した後の実曲確認は未実施。実DOMの調査とローカルの回帰検証を、適用後の確認と区別する。

## 1.3.12 — 2026-10-10 JST、選択式のレコード再生・停止と角丸

操作部分の設定にレコード効果の保存可能なスイッチを追加し、既存ユーザーを含め初期値はオフ。MAIN worldの既存audio bridgeからオプションを受信。ネイティブの下部再生ボタンのクリックとSpaceを扱い、SoundSkyは既存のネイティブボタンクリック経由で共通化する。再生元や出力経路の作り直しはせず、AudioBufferSourceのplaybackRateに0.24秒の加速／0.42秒の減速を適用し、減速後にネイティブの停止操作を行う。HTMLMediaElementでは一時的にpreservesPitchをfalseにし、元の速度とピッチ補正を保存・復元。AudioBufferSourceの終了、曲変更、シーク、効果オフ、破棄に対応し、減速中の連打は加速へ反転。読み込みが遅い場合と予約されたstart時刻にも対応し、後続のストリーミング用sourceは再加速しない。公式仕様の確認: [AudioBufferSourceNode.playbackRate](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate)、[HTMLMediaElement.preservesPitch](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch)。

実Web Audioのローカルブラウザ検証で、スイッチの初期値・保存・Space・ネイティブの遅延停止・連打での反転・オフでの即時停止を確認。再生開始のrate約0.08、通常時1、減速途中約0.61を測定。OfflineAudioContextで440Hzの波形を減速して描画し、初期区間約420Hz、末尾区間約40Hzを確認。これはローカル音声による検証であり、新ビルドでの実SoundCloud音源の聴感確認は再読み込み後に必要。

通常ページの固定12px角丸を3%に、下部の小さなカバーとSoundSkyのNext Upも3%に変更。modern iframeの画像枠も対象とし、アバターは円形のまま。再生中の角丸は幅×(0.03＋拡大率×0.3)とし、40pxの小さな画像は約1.92px、200px画像は約9.6pxになる。単体テストで幅に比例することを確認し、ブラウザ回帰テストにも小さいカバーの角丸確認を追加。

型検証・69件のNodeテスト・1.3.12の配布パッケージ生成が成功。通常操作部の既存ブラウザ検証も成功し、アイコン・金属描画・停止／再開時の同一canvas保持・アクセント色のちらつき防止・シーク中央揃え・進捗補間・ドラッグ・テーマ解除を維持。減速途中のオフでもAudioParamの進行中のカーブを解除してrate 1へ戻り、遅延停止が実行されないことを実Web Audioで確認。カバーのブラウザ検証では40pxの角丸が2px未満となり、ホーム・タグ・プレイリスト行・iframeの反応、アバターの保持、停止とreduced motionでの復元、エラーなしを確認。

## 1.3.13 — 2026-10-12 JST、次の音声の先読み

SoundCloudの[再生処理の説明](https://developers.soundcloud.com/blog/playback-on-web-at-soundcloud/)と[現行APIの説明](https://developers.soundcloud.com/docs/api/guide)を確認。公開曲ページのhydrationから、現在の音声候補がAAC HLSを含むこと、streamable・policy・track_authorization・transcodingsを持つことを確認した。クライアントIDの固定や独自の再生経路追加はせず、既存のMAIN bridgeでSoundCloudが行ったAPI通信から接続情報と選択中の音声形式を観測する。Next Upで確定した次の最大3曲のみを低優先度・逐次取得する。必要な曲情報がまだなければ同じ曲のページのhydrationを取得する。外部サイトの任意URLや再生不可・試聴・暗号化された音声は対象としない。

APIのJSON、HLSリスト、初期化データ、音声セグメントをセッション中のメモリに保持し、取得を完了した曲だけ準備済みと表示。上限24MiB・有効期間15分。現在の再生通信では先読みを中断し、部分取得を再利用して続行する。オフ・キュー変更・終了で不要な処理を取り消す。次の曲が現在の曲になった際には保存データを維持。ネイティブのPOST body・Range・abort・no-store/reloadを維持し、成功したネイティブのstream resolverが新しい署名を返した場合だけ、同じ曲・同じCDNパスの保存済みリストへ対応付ける。URL署名を一律に無視する処理はない。認証情報をUI・ディスク・CDNへ転送しない。バックエンドの認証通信が残るケースがあるため、完全なオフライン保証とは区別する。

Nodeで、確定済みキューとシャッフル／仮想リストの順序、AutoPlayで次がない状態、1〜3曲・オフの範囲、全音声の一時保存と現在曲への昇格、POST保持、Rangeとabort、署名変更、期限・破棄、暗号化と容量上限、サイズ不明の過大ストリームでの中断、現在の再生通信の優先、利用不可の新しい情報での失効を検証。

ローカルブラウザのSoundCloud模擬ページで実際のAAC/fMP4音声を使用。3曲分のHLSリスト＋init＋4セグメント、計18リクエストを先読みし、「3曲中3曲の音声を準備済み」を確認。次の曲へ進めた後、ブラウザをオフラインへ切り替え、保存済みresolverとリストから5パートを取得してMediaSourceへ追加し、readyState 4・duration約3.023秒・再生時間の進行を確認。音声の追加ネットワークリクエストなし、設定オフ、ランタイムエラーなし。これは模擬ページでの音声再利用の検証であり、ユーザーのSoundCloudページのネイティブ再生エンジンでの確認は、新ビルドの再読み込み後に必要。

AAC検証データはtests/fixtures/prefetch-audioに含む、440Hz・3秒の合成音。ffmpegのsineソースからAAC・fMP4 HLS（1秒セグメント）として生成した。音楽作品のデータではない。


先読みの範囲も調整可能にした。曲数は0〜3曲、各曲は冒頭15／30／60／120秒または曲全体。HLSのEXTINFから必要な区間までのセグメントだけを取得する。準備済み表示も冒頭の範囲を区別し、範囲変更時は準備済み判定を取り消して必要な分を追加する。15秒→30秒→曲全体の変更で、5秒ずつの8セグメントのうち取得数が3→6→8となり、取得済みの再ダウンロードがないことを単体テストで確認。時間を指定した先読みは対応するHLS形式に限り、progressiveは曲全体の場合のみ対象とする。

型検証・83件のNodeテスト・配布パッケージ生成が成功。最終ブラウザ検証でも3曲分の音声の準備、通信切断中のMSE再生、現在曲への昇格、追加音声ダウンロードなし、オフ、曲数と読み込み範囲の設定保存、ランタイムエラーなしを確認した。再実行時に前回のオフ設定が残るケースを修正し、模擬ページの設定を初期化して検証している。


## 1.3.14 — 2026-10-12 JST、AutoPlayの確定キューと現行配信先

ユーザーのChromeでNext Upが20行あり、先読み対象が2曲、一時停止中で準備済み0曲と表示されていることを読み取り確認。AutoPlayの有効・無効を先読み条件に使っていないことを確認した。公開実曲のSoundCloud APIとHLSリストを調べると、配信先が従来のsndcdn.comではなくplayback.media-streaming.soundcloud.cloudであり、先読みの配信先制限で拒否されていた。このホストを明示的に対応先へ追加し、未知の外部配信先への制限は維持した。

一時停止中に確定した次の曲の準備も許可する。現在曲の通信の優先・先読みのオフ・未確定キューでの無通信は維持。取得できない1曲で全体を止めず、残りの確定曲を続行する。表示を待機・読み込み中・通信の回復待ち・現在曲の通信待ち・容量上限・取得失敗に分け、0曲の理由が分からない状態を改善。

Nodeを使った実公開音声の取得で、以前ユーザーが挙げたshiroi_ice/nocturnalの公開ページとAPIから提供された再生情報を使用し、修正後の先読みクラスで冒頭15秒までのbroker・リスト・init・音声を5エントリー、429009バイト取得した。音声配信先はplayback.media-streaming.soundcloud.cloud。ユーザーの認証情報や固定クライアントIDは使用しておらず、音声ファイルの保存もしていない。最初のNode/JSDOM確認は異なる環境のAbortSignalを混在させて失敗したため、NodeのネイティブAbortSignalで取得処理を確認した。この確認と、適用後のユーザーのネイティブプレイヤー検証を区別する。

ブラウザ模擬ページも現行の配信ホストに変更し、AutoPlayのチェックを有効にしたまま一時停止中の3曲の準備を確認。全18リクエストの取得と、通信切断後のMSE再生、現在曲へのデータ維持、追加ダウンロードなし、曲数と時間範囲の保存、オフ、ランタイムエラーなしを確認した。

最終の型検証、86件のNodeテスト、1.3.14の配布ビルドが成功。AutoPlay有効・一時停止中・現行配信先での3曲準備と、通信切断後の音声再利用のブラウザ回帰検証も成功。適用後のユーザーの実キューでの準備数確認は再読み込み後。


## 1.3.15 — 2026-10-12 JST、先読み済みの行表示

音声ブリッジから、選択した範囲の準備が完了した曲のキーだけを状態通知へ追加。Next Upの対応する行に薄いグレーの点線を付ける。再生中・履歴の行は対象外。ネイティブの行再利用ではリンク先を追跡し、設定範囲・曲数変更・オフ・破棄で印を解除する。SoundSkyとテーマ有効の通常SoundCloudをCSSで個別に対象とし、列幅や行の高さ・クリック操作を変更しない。

型検証、87件のNodeテスト、1.3.15の配布ビルド成功。ローカルSoundCloud模擬ページで3曲準備後の印、2pxの点線・56pxの行高、通常画面のテーマでの点線、曲送りによる仮想行再生成後の2曲への追従、再生中の印の除外、オフ時の解除を確認。既存のAAC/fMP4の通信切断中MSE再生と追加音声ダウンロードなしの検証も成功。ランタイムエラーなし。ユーザーの実ページへの適用確認は拡張機能とタブの再読み込み後。


## 1.3.16 — 2026-10-12 JST、進捗の点線と実再生のキャッシュ経路

ユーザーの実DOMを読み取り、先読み量は曲全体、3曲準備済み、現在のSoundSkyカバーはt500x500、ネイティブの画像はt120x120と確認。公開ページに読み込まれるSoundCloudの55-f24f7f25.jsを取得して、音声ローダーがネイティブXMLHttpRequestでGET・arraybuffer等を使用することを確認。従来の検証はfetchだけで保存データを再利用しており、この経路を見落としていた。

準備したCDN応答は同一リクエストまたは成功したネイティブbrokerで認可された同一パスの別署名に限り、Blob URLを使ったネイティブXHRで返す。responseType・timeout・withCredentialsを引き継ぎ、元のCDN responseURLを提示する。APIのXHRはネイティブ通信のまま。Range・同期・非GET・未保存データはネイティブ通信を維持。中断・再利用・破棄を処理し、Blob URLを解放する。実ページの権限確認や未取得データが通信を要する点は変わらない。

曲切り替え中の未確定・一時的に別のキュー情報では音声を削除せず、TTL・オフ・容量圧迫時に整理する。現在曲と確定した次の曲を容量整理の対象から除外。同じ形式のネイティブresolver観測では準備済み判定を維持し、異なる形式なら準備をやり直す。メタデータのカバーを500pxで先読みし、large形式のカバーURLも拡大表示用に変換する。

曲ごとの取得進捗をブリッジから通知。HLSは対象セグメント数、Content-Lengthが分かる場合はセグメント内の取得バイト比率を用いる。Content-Length不明はセグメント完了時に進む。完了前は最大99%、全体準備完了で100%。点線はclip-pathで上から下へ表示範囲を伸ばす。設定範囲・オフ・失効を反映し、再生中の実線を優先。reduced-motionでは伸びる補間を無効にする。

型検証・90件のNodeテスト・配布ビルド成功。キューの一時空白と別の行への差し替え後も3曲の音声が残ること、同じ形式の観測後の準備判定保持、部分進捗・完了・範囲変更を確認。

ローカルSoundCloud模擬ページではAAC/fMP4の32秒の合成音（440Hz・48kbps、ffmpeg lavfi sineから生成、prefetch-long-audio）を使用。3曲のmanifest+init+5セグメント計21リクエストを取得。2つ目のセグメントを保留して20%の点線と未完了判定を確認した。曲送り後に通信を遮断し、保存したmanifestと6パートをネイティブXHRのtext/arraybufferで取得、MediaSourceへ追加。duration32.023219秒、readyState4、25秒位置からの再生時間の進行、音声の追加ダウンロードなしを確認。XHRの即時abortと同じインスタンスの再利用も検証し、その際見つかったloadからloadendまでの再利用判定を修正した。高解像度画像3曲分の要求、通常テーマとSoundSkyの点線、設定オフ、ランタイムエラーなしも確認。

これは模擬ページのネイティブXHRとMSEでの検証。ユーザーのSoundCloudエンジンでの切り替えと20秒以降の実再生確認は、1.3.16への再読み込み後に必要。
