# 商用品質の完了条件

対象: 1.3.31。目標は、日常のSoundCloud利用で再生を壊さず、設定と見た目が一貫し、検証済みの配布物を再現して届けられることです。

商用品質の達成はまだ未証明です。自動テスト・ローカル画面の確認と、更新後の実SoundCloud・OSでの確認を別々に記録します。

## 検証する範囲

| 要件 | 現在の根拠 | 残る確認 |
| --- | --- | --- |
| 再生・一時停止・連打・反転時に音量、音程、再生状態を復元する | `tests/turntable.test.mjs`、`tests/audio.test.mjs` | 更新後の実SoundCloudとmacOSメディア操作UI。手前／背面の両方 |
| 停止・再開で位置を整数へ戻さず、短いシークにも追従する | `tests/playback-clock.test.mjs`、`tests/native-transport.test.mjs` | 実曲、停止中、曲終了付近、メディアUIからのシーク |
| 初回・既存タブ・更新後の起動を回復し、入口を見失わない | `tests/background.test.mjs`、`tests/native-transport.test.mjs`。ローカルChromeの390px／通常幅で入口の切り替えを確認 | 実SoundCloudの初回導入、読み込み前のタブ、再生バー非表示 |
| 設定ページとサイドバーが同じ値を共有し、曲を止めずに使える | `tests/native-preferences.test.mjs`、`tests/lifecycle.test.mjs`、`tests/account-settings.test.mjs` | 更新後の本家設定の保存、認証画面、ページ遷移、低速回線 |
| 複数タブの同時変更で無関係な項目を消さない | `tests/settings-concurrency.test.mjs`。実際の保存側と表示側のコードを組み合わせ、遅延・返信順逆転・失敗後の再試行を検証 | 更新後の複数の実SoundCloudタブ。同じ項目への競合は最後の保存を反映 |
| SoundCloudのLight／Dark／Automaticに追従し、DiscoverとNext Upを読める | `tests/native-appearance.test.mjs`、`tests/site-theme.test.mjs`、ローカルChromeでLight切り替え・Next Upの背景を確認 | 更新後の実Discover、検索、曲・アーティスト・設定ページ、AutomaticのOS切り替え |
| キーボード操作で背面へ迷い込まず、iframeから戻れる | `tests/focus.test.mjs`、`tests/account-settings.test.mjs`。ローカルChromeで390px幅のTab／Shift+Tabと設定維持を確認 | 実SoundCloudの各設定フォームと読み上げ環境 |
| 長時間の再生・曲変更・開閉で重くならず、破棄時に資源を解放する | `tests/lifecycle.test.mjs` の開閉・再注入・Observer／タイマー解放、音声とキャッシュの上限・破棄テスト。音声寿命の2000コンテキストの模擬検証と、実Chromeで201件のOfflineAudioContextの波形・監視解放を確認 | 実音声での長時間利用、低性能端末、復帰後のCPU・メモリ・音切れ |
| 設定の読み込み・保存・起動に失敗しても回復方法が分かる | 保存状態、起動アイコンの説明、iframeの待機・失敗・再試行のテスト | 実環境の通信失敗と拡張機能更新中の操作 |
| 壊れたビルドや古いZIPを配布しない | `tests/distribution.test.mjs`、`npm run verify`。ファイル不足、コンパイル失敗、差し替え失敗、ZIPの古い実データを拒否 | リリース対象コミットのGitHub CI成功と配布物の導入 |
| 説明と実装の通信・保存動作が一致する | READMEのプライバシー欄を先読みの追加通信とメモリ内の認可情報の扱いに合わせて修正 | 今後の機能追加時にも同じ確認を行う |

## 確認コマンド

```sh
npm ci
npm run verify
```

`verify` は型検証、全Nodeテスト、配布ビルド、配布前ZIP検証を順に実行します。ZIP検証ではmanifest、起動スクリプト、適用先、アイコン、導入ガイド、依存ライブラリーのライセンス、ZIP内の各ファイルの実データを確認します。

ビルドとZIPは作業領域で検証してから置き換えます。ビルドの差し替えに失敗した場合は旧ビルドへ戻し、復元にも失敗した場合は旧ビルドのバックアップを消さず、場所をエラーに示します。

## 実機確認の進め方

1. 拡張機能と開いているSoundCloudタブを再読み込みし、設定左上の版を確認する。
2. [BETA-TEST.md](BETA-TEST.md) の操作を、レコード効果・サイトの着せ替えのオン／オフ、Light／Darkで確認する。
3. 実際のmacOSメディア操作UIを使い、タブが手前／背面の場合の停止と再開を確認する。
4. 不具合が出た操作を記録し、修正後に同じ条件で再検証する。
5. 10〜20人の1週間の継続利用で、重大な不具合と使い続ける価値を確認する。募集・連絡はまだ行っていない。

ブラウザーのURLポリシーで拡張機能管理画面の操作がブロックされたため、エージェントによる管理画面の再読み込みは行っていません。この制限を回避する操作も行いません。既存の実ページ確認を、新ビルドの実機確認として扱いません。
