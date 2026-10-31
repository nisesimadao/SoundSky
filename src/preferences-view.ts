import { icon } from './icons';
export type NumericSetting = 'turntableSpeed' | 'pulseMax' | 'pulseSensitivity' | 'ambientSpeed' | 'materialSpeed' | 'heatSpeed' | 'prefetchCount' | 'heatResponse' | 'ambientGlow' | 'consoleSpeed' | 'seekSpeed' | 'sceneSway' | 'siteBackdropOpacity';
export type SiteToggle = 'siteHeader' | 'siteArtwork' | 'siteQueue' | 'siteTransport' | 'siteBackground' | 'siteWide';
const siteToggle = (key: SiteToggle, label: string, help: string) => `
  <div class="settings-site-item">
    <div class="settings-label-row settings-toggle"><label for="setting-${key}">${label}</label><input class="settings-site-toggle" id="setting-${key}" data-site-toggle="${key}" type="checkbox" role="switch" aria-describedby="hint-${key}"><output id="val-${key}"></output></div>
    <p class="settings-hint" id="hint-${key}" hidden>${help}</p>
  </div>`;
export const settingValue = (key: NumericSetting, value: number) => {
  if (key === 'turntableSpeed') return `${value.toFixed(1)}×`;
  if (key === 'prefetchCount') return value === 0 ? 'オフ' : `${value}曲`;
  if (key === 'sceneSway' || key === 'siteBackdropOpacity') return value === 0 ? 'オフ' : `${Math.round(value * 100)}%`;
  if (value === 0) return key === 'pulseMax' ? 'なし' : key === 'ambientGlow' ? '消灯' : key === 'heatResponse' ? '反応なし' : '停止';
  return key === 'pulseMax' ? `+${(value * 100).toFixed(1)}%` : key === 'ambientGlow' ? `${Math.round(value * 100)}%` : `${value.toFixed(1)}倍`;
};
const settingControl = (key: NumericSetting, label: string, min: number, max: number, step: number, hint: string, low: string, high: string) => `
  <div class="settings-group">
    <div class="settings-label-row"><label for="setting-${key}">${label}</label><div class="settings-value-actions"><output class="settings-val" id="val-${key}" for="setting-${key}"></output><button class="settings-default" data-command="setting-default" data-setting-key="${key}" aria-label="${label}を標準に戻す" title="標準に戻す">${icon('reset')}</button></div></div>
    <p class="settings-hint" id="hint-${key}">${hint}</p>
    <div class="settings-range-wrap">
      <input class="settings-slider" id="setting-${key}" type="range" min="${min}" max="${max}" step="${step}" data-setting="${key}" aria-describedby="hint-${key}" title="${low} – ${high}">
    </div>
    <div class="settings-scale" aria-hidden="true"><span>${low}</span><span>${high}</span></div>
  </div>`;
export const preferencesMarkup = `
          <section class="settings-panel" id="visual-settings" popover="manual" aria-labelledby="settings-title" hidden>
            <div class="settings-header">
              <div><p class="settings-eyebrow">SoundSky <span>/</span> Preferences</p><h2 class="settings-title" id="settings-title">設定</h2></div>
              <button class="icon-button" data-command="settings-close" aria-label="設定を閉じる" title="設定を閉じる · Escape">${icon('close')}</button>
            </div>
            <div class="settings-tabs" role="tablist" aria-orientation="horizontal" aria-label="設定のカテゴリ">
              <button class="settings-tab" role="tab" id="tab-controls" aria-controls="settings-controls" aria-selected="true" tabindex="0" data-settings-tab="controls">再生</button>
              <button class="settings-tab" role="tab" id="tab-visual" aria-controls="settings-visual" aria-selected="false" tabindex="-1" data-settings-tab="visual">見た目</button>
              <button class="settings-tab" role="tab" id="tab-site" aria-controls="settings-site" aria-selected="false" tabindex="-1" data-settings-tab="site">サイト</button>
              <button class="settings-tab" role="tab" id="tab-account" aria-controls="settings-account" aria-selected="false" tabindex="-1" data-settings-tab="account">SoundCloud設定</button>
            </div>
            <div class="settings-section" role="tabpanel" id="settings-controls" aria-labelledby="tab-controls">
              <div class="settings-section-heading"><h3>再生</h3><p>いつもの音楽を、自分の聴き方で。</p></div>
              <div class="settings-group"><div class="settings-label-row settings-toggle"><label for="setting-focusMode">集中表示</label><input id="setting-focusMode" type="checkbox" role="switch" aria-describedby="hint-focusMode"><output id="val-focusMode"></output></div><p class="settings-hint" id="hint-focusMode">再生中、操作がないとボタンを隠します。マウスやキーボードで再び表示できます。</p></div>
              <div class="settings-group"><div class="settings-label-row settings-toggle"><label for="setting-turntable">レコードのように再生・停止</label><input id="setting-turntable" type="checkbox" role="switch" aria-describedby="hint-turntable"><output id="val-turntable"></output></div><p class="settings-hint" id="hint-turntable">レコードのように音程と速度を変えながら、再生・一時停止します。</p></div>
              ${settingControl('turntableSpeed', 'レコード効果の速さ', .5, 2, .1, 'レコード効果がオンのときに調整できます。', 'ゆっくり', '速く')}
              <details class="settings-details"><summary>次の曲の先読み</summary><p class="settings-hint">次の曲の音声を一時的に準備します。タブを閉じると破棄されます。</p>
                ${settingControl('prefetchCount', '先読みする曲数', 0, 3, 1, 'オフにすると、先読みの通信を止めます。', 'オフ', '3曲')}
                <div class="settings-group"><div class="settings-label-row"><label for="setting-prefetchSeconds">各曲の読み込み量</label><select class="settings-choice" id="setting-prefetchSeconds" aria-describedby="hint-prefetchSeconds"><option value="15">冒頭15秒</option><option value="30">冒頭30秒</option><option value="60">冒頭1分</option><option value="120">冒頭2分</option><option value="0">曲全体</option></select></div><p class="settings-hint" id="hint-prefetchSeconds">冒頭だけなら通信量を抑えられます。</p></div>
                <p class="settings-hint" id="prefetch-status" aria-live="polite">次の曲の準備待ち</p>
              </details>
            </div>
            <div class="settings-section" role="tabpanel" id="settings-visual" aria-labelledby="tab-visual" hidden>
              <div class="settings-section-heading"><h3>見た目</h3><p>Light／DarkはSoundCloudの設定に合わせます。</p></div>
              ${settingControl('pulseMax', 'カバーの拡大', 0, .3, .005, '音に合わせてジャケットが拡大する上限。', '拡大なし', '最大 +30%')}
              <div class="settings-effect-toggle"><div class="settings-label-row settings-toggle"><label for="setting-heatEnabled">カバー周囲の光</label><input id="setting-heatEnabled" type="checkbox" role="switch" aria-describedby="hint-heatEnabled"><output id="val-heatEnabled"></output></div><p class="settings-hint" id="hint-heatEnabled">音に反応する赤い光と、流れる空色の帯。</p></div>
              <details class="settings-details"><summary>カバーの反応を調整</summary>
                ${settingControl('pulseSensitivity', '音への反応', .2, 12, .1, '上げるほど、小さな音にも反応します。', '控えめ', '強く')}
                <div class="settings-heat-controls">
                  ${settingControl('heatResponse', '赤い光の反応', 0, 3, .1, '上げるほど、赤い光が広がります。', '反応なし', '強く')}
                  ${settingControl('heatSpeed', '光が流れる速さ', 0, 8, .1, '赤い光と空色の帯の流速。', '停止', '速く')}
                </div>
              </details>
              <details class="settings-details"><summary>背景の動きを調整</summary>
                ${settingControl('ambientSpeed', '背景の動く速さ', 0, 8, .1, '画面全体に広がる模様の流速。', '停止', '速く')}
                ${settingControl('sceneSway', '画面のゆらぎ', 0, 1, .05, '画面がゆっくり揺れ、低音に合わせて動きます。', 'オフ', '最大 約14px')}
                ${settingControl('ambientGlow', '背景の明るさ', 0, 2, .05, '音に反応する背景の光量。', '消灯', '明るく')}
              </details>
              <details class="settings-details"><summary>操作部の質感を調整</summary>
                ${settingControl('materialSpeed', '再生ボタンの質感', 0, 8, .1, '金属の表面が流れる速さ。', '停止', '速く')}
                ${settingControl('consoleSpeed', '操作パネルの煙', 0, 2, .1, '再生ボタンの周りに流れる煙の速さ。', '停止', '速く')}
                ${settingControl('seekSpeed', 'シークバーの色の流れ', 0, 3, .1, '再生済みの部分を流れる色。曲の再生速度は変わりません。', '停止', '速く')}
              </details>
            </div>
            <div class="settings-section" role="tabpanel" id="settings-site" aria-labelledby="tab-site" hidden>
              <div class="settings-section-heading"><h3>SoundCloud</h3><p>SoundCloudの通常ページにも適用します。</p></div>
              <div class="settings-effect-toggle">
                <div class="settings-label-row settings-toggle"><label for="setting-modernSoundCloud">SoundCloudの見た目を整える</label><input id="setting-modernSoundCloud" type="checkbox" role="switch" aria-describedby="hint-modernSoundCloud"><output id="val-modernSoundCloud"></output></div>
                <p class="settings-hint" id="hint-modernSoundCloud">オフでも全画面プレイヤーは使えます。テーマはSoundCloudに合わせます。</p>
              </div>
              <div class="settings-site-details">
                <h3 class="settings-subheading">適用する場所</h3>
                <div class="settings-site-grid">
                  ${siteToggle('siteHeader', 'ヘッダー・検索', 'ヘッダーと検索欄の配色')}
                  ${siteToggle('siteArtwork', 'カバー・一覧', 'ジャケットと曲一覧の表示')}
                  ${siteToggle('siteQueue', 'Next Up', '次に再生する曲の一覧')}
                  ${siteToggle('siteTransport', '下部プレイヤー', '再生バーと操作ボタン')}
                  ${siteToggle('siteBackground', '背景の光', '通常ページの背景に表示する光')}
                  ${siteToggle('siteWide', 'ワイドレイアウト', 'ページの表示幅を広げる')}
                </div>
                <h3 class="settings-subheading">表示</h3>
                <div class="settings-site-options">
                  <div class="settings-group settings-site-option"><div class="settings-label-row"><label for="setting-siteCorners">パーツの丸み</label>
                    <select class="settings-choice settings-site-choice" id="setting-siteCorners" data-site-choice="siteCorners">
                      <option value="subtle">シャープ</option><option value="soft">標準</option><option value="round">やわらかい</option>
                    </select></div><p class="settings-hint">ボタンやカード、入力欄の輪郭。</p></div>
                  <div class="settings-group settings-site-option"><div class="settings-label-row"><label for="setting-siteAccent">アクセントカラー</label>
                    <select class="settings-choice settings-site-choice" id="setting-siteAccent" data-site-choice="siteAccent">
                      <option value="artwork">再生中のジャケット</option><option value="sky">スカイブルー</option><option value="warm">アンバー</option>
                    </select></div><p class="settings-hint">リンクや再生バーの強調色を選びます。</p></div>
                  ${settingControl('siteBackdropOpacity', '背景の光の強さ', 0, .7, .05, '通常ページに重ねる光の濃さ。', 'オフ', '強く')}
                </div>
              </div>
            </div>
            <div class="settings-section settings-account" role="tabpanel" id="settings-account" aria-labelledby="tab-account" hidden></div>
            <div class="settings-footer"><span class="settings-save-status" role="status" aria-live="polite">自動保存</span><button class="settings-reset" data-command="settings-reset">すべて標準に戻す</button></div>
          </section>
`;
