import { SoundCloudAdapter, artworkURL } from './adapter';
import { NativeQueue } from './queue';
import { Ambient } from './ambient';
import { Atmosphere } from './atmosphere';
import { NativeTransport } from './native-transport';
import { SiteTheme } from './site-theme';
import { loadSavedSettings } from './settings';
import { CoverPulse } from './cover-pulse';
import { SceneFlow } from './scene-flow';
import { Materials } from './materials';
import { ArtworkAccent, accentColor } from './accent';
import { icon } from './icons';
import css from './player.css';
import { type Action, type PlayerState, type Track, type SoundSkySettings, defaultSettings } from './types';

const VERSION = '1.3.6';
declare global { interface Window { __soundsky?: { version: string; toggle(): void; destroy(): void }; } }
export const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}`;
};

type NumericSetting = Exclude<keyof SoundSkySettings, 'heatEnabled' | 'modernSoundCloud'>;
const settingValue = (key: NumericSetting, value: number) => {
  if (key === 'sceneSway') return value === 0 ? 'オフ' : `${Math.round(value * 100)}%`;
  if (value === 0) return key === 'pulseMax' ? 'なし' : key === 'ambientGlow' ? '消灯' : key === 'heatResponse' ? '反応なし' : '停止';
  return key === 'pulseMax' ? `+${(value * 100).toFixed(1)}%` : key === 'ambientGlow' ? `${Math.round(value * 100)}%` : `${value.toFixed(1)}倍`;
};
const settingControl = (key: NumericSetting, label: string, min: number, max: number, step: number, hint: string, low: string, high: string) => `
  <div class="settings-group">
    <div class="settings-label-row"><label for="setting-${key}">${label}</label><output class="settings-val" id="val-${key}" for="setting-${key}"></output></div>
    <p class="settings-hint" id="hint-${key}">${hint}</p>
    <div class="settings-range-wrap" style="--default-position: ${(defaultSettings[key] - min) / (max - min) * 100}%">
      <input class="settings-slider" id="setting-${key}" type="range" min="${min}" max="${max}" step="${step}" data-setting="${key}" aria-describedby="hint-${key}">
      <i class="settings-default-tick" aria-hidden="true"></i>
    </div>
    <div class="settings-scale"><span>${low}</span><button data-command="setting-default" data-setting-key="${key}" aria-label="${label}を標準に戻す">標準 ${settingValue(key, defaultSettings[key])}</button><span>${high}</span></div>
  </div>`;
class SoundSky {
  private host = document.createElement('soundsky-player');
  private shadow = this.host.attachShadow({ mode: 'open' });
  private adapter = new SoundCloudAdapter();
  private queue: NativeQueue;
  private ambient: Ambient;
  private atmosphere: Atmosphere;
  private materials: Materials;
  private accent: ArtworkAccent;
  private transport: NativeTransport;
  private siteTheme = new SiteTheme();
  private active = false;
  private disposed = false;
  private state: PlayerState = this.adapter.read();
  private unsubscribe: () => void;
  private events = new AbortController();
  private lastTrack = '';
  private lastArt = '';
  private lastPlaying: boolean | null = null;
  private artworkGeneration = 0;
  private trackAnimations = new Set<Animation>();
  private outgoingArtwork: HTMLImageElement | null = null;
  private animation = 0;
  private clockAt = performance.now();
  private clockCurrent = 0;
  private analysisActive: boolean | null = null;
  private audioLevel = 0;
  private audioOnset = 0;
  private audioAt = 0;
  private artScale = 1;
  private coverPulse = new CoverPulse();
  private pulseFrameAt = 0;
  private sceneFlow = new SceneFlow();
  private swayAmplitude = 0;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private scrubbing = false;
  private scrubKey = '';
  private volumeEditing = false;
  private focusBefore: HTMLElement | null = null;
  private previousOverflow = '';
  private backgroundInert = new Map<HTMLElement, boolean>();
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private ownsFullscreen = false;
  private nativeModalObserver = new MutationObserver(() => {
    if (this.active && document.querySelector('.modal.auth-modal, .modal [role="dialog"], .repostDropdown, [id^="repost-dropdown-"]')) this.close();
  });
  private pendingActions = new Set<Action>();
  private settings: SoundSkySettings = { ...defaultSettings };
  private settingsOpen = false;

  constructor() {
    // Old isolated worlds survive an extension reload until page navigation.
    // A DOM-only teardown signal allows their instance to release all resources.
    document.dispatchEvent(new CustomEvent('soundsky:dispose'));
    this.reducedMotion.addEventListener('change', () => this.clearTrackAnimations(), { signal: this.events.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearTrackAnimations(); }, { signal: this.events.signal });
    document.addEventListener('soundsky:dispose', () => this.destroy(), { signal: this.events.signal });
    this.shadow.innerHTML = `<style>${css}</style>
      <button class="launcher" title="Open SoundSky · Alt/Option + Shift + Y" aria-label="Open SoundSky">${icon('sky')}<span>SoundSky</span></button>
      <section class="player" role="dialog" aria-modal="false" aria-label="SoundSky music player" hidden>
        <div class="ambient-fallback"></div><canvas class="ambient" aria-hidden="true"></canvas><div class="atmosphere" aria-hidden="true"></div><div class="veil"></div>
        <div class="shell">
          <header class="topbar"><div class="brand">${icon('sky')}<span>SoundSky</span><span class="brand-caption">MUSIC PLAYER</span></div>
            <div class="top-actions">
              <button class="icon-button" data-command="settings" aria-label="見た目の設定" aria-expanded="false" aria-controls="visual-settings" title="見た目の設定">${icon('tune')}</button>
              <button class="return" data-command="close" aria-label="Back to SoundCloud" title="Return to SoundCloud · Escape">${icon('down')}<span>Back to SoundCloud</span></button>
              <button class="icon-button" data-command="fullscreen" aria-label="Enter fullscreen" title="Fullscreen">${icon('expand')}</button>
            </div>
          </header>
          <section class="settings-panel" id="visual-settings" popover="manual" aria-labelledby="settings-title" hidden>
            <div class="settings-header">
              <div><p class="settings-kicker">SOUNDSKY / VISUALS</p><h2 class="settings-title" id="settings-title">見た目の設定</h2></div>
              <button class="settings-close icon-button" data-command="settings-close" aria-label="設定を閉じる">${icon('close')}</button>
            </div>
            <div class="settings-tabs" role="tablist" aria-label="設定のカテゴリ">
              <button class="settings-tab" role="tab" id="tab-cover" aria-controls="settings-cover" aria-selected="true" tabindex="0" data-settings-tab="cover">カバー</button>
              <button class="settings-tab" role="tab" id="tab-light" aria-controls="settings-light" aria-selected="false" tabindex="-1" data-settings-tab="light">周囲の光</button>
              <button class="settings-tab" role="tab" id="tab-background" aria-controls="settings-background" aria-selected="false" tabindex="-1" data-settings-tab="background">背景</button>
              <button class="settings-tab" role="tab" id="tab-controls" aria-controls="settings-controls" aria-selected="false" tabindex="-1" data-settings-tab="controls">操作部分</button>
              <button class="settings-tab" role="tab" id="tab-site" aria-controls="settings-site" aria-selected="false" tabindex="-1" data-settings-tab="site">SoundCloud</button>
            </div>
            <div class="settings-section" role="tabpanel" id="settings-cover" aria-labelledby="tab-cover">
              <p class="settings-section-note">音に合わせたジャケットの動きを調整します。</p>
              ${settingControl('pulseMax', '拡大の上限', 0, .3, .005, '音が強いとき、元の大きさからどこまで拡大するか。', '拡大なし', '最大 +30%')}
              ${settingControl('pulseSensitivity', '音への反応', .2, 12, .1, '音量と音の変化に合わせて動きます。上げるほど反応が強くなります。', '控えめ', '強く')}
            </div>
            <div class="settings-section" role="tabpanel" id="settings-light" aria-labelledby="tab-light" hidden>
              <div class="settings-effect-toggle">
                <div class="settings-label-row settings-toggle"><label for="setting-heatEnabled">カバー周囲の光</label><input id="setting-heatEnabled" type="checkbox" role="switch" aria-describedby="hint-heatEnabled"><output id="val-heatEnabled"></output></div>
                <p class="settings-hint" id="hint-heatEnabled">赤い光は音に反応し、空色の帯は一定の速さで流れます。</p>
              </div>
              <div class="settings-heat-controls">
                ${settingControl('heatResponse', '赤い光の反応', 0, 3, .1, '上げるほど、同じ音量でも赤い光が下まで広がります。', '反応なし', '強く')}
                ${settingControl('heatSpeed', '光が流れる速さ', 0, 8, .1, '空色の帯の流速。赤い光もこの速さを基準に動きます。', '停止', '速く')}
              </div>
            </div>
            <div class="settings-section" role="tabpanel" id="settings-background" aria-labelledby="tab-background" hidden>
              <p class="settings-section-note">背景は音が強いと明るく速く、静かなときは暗くゆっくり動きます。</p>
              ${settingControl('ambientSpeed', '背景の動く速さ', 0, 8, .1, '画面全体に広がる模様の動き。0で止まります。', '停止', '速く')}
              ${settingControl('sceneSway', '画面のゆらぎ', 0, 1, .05, 'ランダムな地点へ約5秒で移動し、キックで加速して徐々に元の速さへ戻ります。停止中は止まります。', 'オフ', '最大 約14px')}
              ${settingControl('ambientGlow', '背景の明るさ', 0, 2, .05, '音に反応する背景の光量。0で光を消します。', '消灯', '明るく')}
            </div>
            <div class="settings-section" role="tabpanel" id="settings-site" aria-labelledby="tab-site" hidden>
              <div class="settings-effect-toggle">
                <div class="settings-label-row settings-toggle"><label for="setting-modernSoundCloud">SoundCloudの見た目を整える</label><input id="setting-modernSoundCloud" type="checkbox" role="switch" aria-describedby="hint-modernSoundCloud"><output id="val-modernSoundCloud"></output></div>
                <p class="settings-hint" id="hint-modernSoundCloud">通常のページも、暗い配色・柔らかい角丸・整った文字へ。アクセントは再生中のカバーの色に合わせます。SoundSkyを閉じても有効です。</p>
              </div>
            </div>
            <div class="settings-section" role="tabpanel" id="settings-controls" aria-labelledby="tab-controls" hidden>
              <p class="settings-section-note">再生ボタンやバーの質感を調整します。</p>
              ${settingControl('materialSpeed', '再生ボタンの動く速さ', 0, 8, .1, '金属のような表面の流れ。音が強いと速く動きます。', '停止', '速く')}
              ${settingControl('consoleSpeed', '操作パネルの煙の速さ', 0, 2, .1, '再生ボタンの土台にある、薄い煙の動き。', '停止', '速く')}
              ${settingControl('seekSpeed', 'シークバーの色の流れ', 0, 3, .1, '再生済みの部分を流れる色。曲の再生速度は変わりません。', '停止', '速く')}
            </div>
            <div class="settings-footer"><span>すぐ反映・自動保存</span><button class="settings-reset" data-command="settings-reset">すべて標準に戻す</button></div>
          </section>
          <main class="stage">
            <div class="artwork-area reveal"><div class="artwork-frame"><div class="cover-heat" aria-hidden="true" hidden></div><div class="artwork"><div class="artwork-placeholder">${icon('music')}</div><img class="art-image" alt="" hidden></div></div></div>
            <div class="details"><div class="metadata reveal"><p class="eyebrow"><span class="live-dot"></span><span class="now-label">NOW PLAYING</span></p>
              <button class="title-link" data-command="track" title="Open this track on SoundCloud"><h1>Your music, in focus.</h1></button>
              <button class="artist" data-command="artist">Play something on SoundCloud to begin.</button>
              <div class="socials">
                <button class="social" data-action="like" aria-label="Like current track" aria-pressed="false" disabled>${icon('heart')}<span>Like</span></button>
                <button class="social" data-action="repost" aria-label="Repost current track" disabled>${icon('repost')}<span>Repost</span></button>
                <button class="social" data-action="follow" aria-label="Follow current artist" aria-pressed="false" disabled>${icon('follow')}<span>Follow artist</span></button>
              </div>
            </div>
            <section class="queue-area reveal" aria-label="Queue"><div class="queue-header"><h2 class="queue-heading">Next up</h2><span class="queue-status">SoundCloud queue</span></div>
              <div class="queue-aperture"><div class="queue-empty">Your queue will appear here.<br>Start a track on SoundCloud.</div></div>
            </section></div>
          </main>
          <footer class="controls reveal"><div class="transport-row"><span class="playback-note">SOUNDCLOUD</span>
            <div class="transport"><div class="console-smoke" aria-hidden="true"></div><button class="icon-button" data-command="previous" aria-label="Previous track" title="Previous">${icon('previous')}</button>
              <button class="play-toggle" data-command="play" aria-label="Play" title="Play · Space"><span class="metal-fallback" aria-hidden="true"></span><div class="metal-surface" aria-hidden="true"></div><span class="play-glyph-outline" aria-hidden="true"></span><span class="play-glyph">${icon('play')}</span></button>
              <button class="icon-button" data-command="next" aria-label="Next track" title="Next">${icon('next')}</button></div>
            <div class="volume"><button class="icon-button" data-command="mute" aria-label="Mute" title="Mute">${icon('volume')}</button><input class="volume-range" type="range" min="0" max="1" step="0.01" value="0.5" aria-label="Volume"></div>
          </div><div class="seek-row"><span class="time current">0:00</span><div class="seek-surface"><div class="seek-light" aria-hidden="true"><div class="seek-fallback"></div><div class="seek-shader"></div></div><input class="seek" type="range" min="0" max="1000" step="any" value="0" aria-label="Seek position"></div><span class="time duration">0:00</span></div>
          <p class="hint">Space to play or pause · Esc to return</p></footer>
        </div><div class="toast" role="status" hidden></div>
      </section>`;
    document.body.append(this.host);
    this.queue = new NativeQueue(this.adapter, this.el('.queue-aperture'));
    this.queue.onUpdate = info => {
      this.el('.queue-empty').hidden = info.available && info.hasTracks && !!this.state.track.key;
      this.setText('.queue-empty', !this.state.track.key ? 'Play something on SoundCloud to see your queue.'
        : !info.available ? 'SoundCloud’s queue is not available yet.' : 'No tracks are queued yet.');
      this.setText('.queue-status', info.autoplay === true ? 'Autoplay on' : info.autoplay === false ? 'Autoplay off' : 'SoundCloud queue');
      this.setText('.queue-heading', info.history ? 'Queue · earlier tracks' : 'Next up');
    };
    this.ambient = new Ambient(this.el<HTMLCanvasElement>('.ambient'), this.el('.ambient-fallback'));
    this.atmosphere = new Atmosphere(this.el('.atmosphere'), this.el('.console-smoke'), this.el('.seek-shader'));
    this.materials = new Materials(this.el('.metal-surface'), this.el('.cover-heat'));
    this.transport = new NativeTransport(this.adapter,()=>this.toggle(),docked=>this.host.toggleAttribute('data-launcher-docked',docked));
    this.accent = new ArtworkAccent(hue => {
      this.host.style.setProperty('--accent', accentColor(hue));
      this.queue.setAccent(accentColor(hue));
      this.atmosphere.setAccent(hue); this.siteTheme.setAccent(hue); this.transport.setAccent(hue);
    }, colors => { this.atmosphere.setPalette(colors); this.siteTheme.setPalette(colors); });
    this.adapter.onRootChange = () => {
      this.transport.sync(this.adapter.read());
      if (!this.active) return;
      this.queue.bind();
      const controls = this.adapter.query<HTMLElement>('.playControls__elements');
      if (controls && !this.backgroundInert.has(controls)) { this.backgroundInert.set(controls, controls.inert); controls.inert = true; }
    };
    this.unsubscribe = this.adapter.subscribe(state => this.render(state));
    this.loadSettings();
    this.bindEvents();
    this.nativeModalObserver.observe(document.body, { childList: true, subtree: true });
    if (globalThis.chrome?.runtime?.id) chrome.runtime.onMessage.addListener(this.message);
  }
  private el<T extends HTMLElement = HTMLElement>(selector: string) { return this.shadow.querySelector<T>(selector)!; }
  private setText(selector: string, value: string) { const el = this.el(selector); if (el.textContent !== value) el.textContent = value; }
  private message = (message: { type?: string }, _sender: chrome.runtime.MessageSender, respond: (value: unknown) => void) => {
    if (message.type !== 'soundsky:toggle') return;
    this.toggle(); respond({ open: this.active, version: VERSION });
  };
  private bindEvents() {
    const signal = this.events.signal;
    window.addEventListener('message', event => {
      if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'soundsky:audio') return;
      const level = event.data.level;
      if (typeof level === 'number' && Number.isFinite(level)) {
        this.audioLevel = Math.max(0, level); this.audioAt = performance.now();
        this.audioOnset = typeof event.data.onset === 'number' && Number.isFinite(event.data.onset) ? Math.max(0, event.data.onset) : 0;
        if (this.active && this.state.playing && !this.state.muted) this.coverPulse.sample(this.audioOnset, this.audioAt, this.audioLevel);
        if (this.active && this.state.playing && !this.state.muted && !this.reducedMotion.matches && this.settings.sceneSway > 0) this.sceneFlow.sample(event.data.bassOnset, this.audioAt);
        this.materials.setLevel(this.state.muted ? 0 : this.audioLevel, this.state.muted ? 0 : this.audioOnset);
        this.atmosphere.setLevel(this.state.muted ? 0 : this.audioLevel, this.state.muted ? 0 : this.audioOnset);
        this.transport.setAudio(this.state.muted?0:this.audioLevel,this.state.muted?0:this.audioOnset);

      }
    }, { signal });
    this.el('.launcher').addEventListener('click', () => this.toggle(), { signal });
    document.addEventListener('pointerdown', event => {
      if (this.settingsOpen && !event.composedPath().includes(this.el('.settings-panel')) && !event.composedPath().includes(this.el('[data-command="settings"]'))) this.toggleSettings(false);
    }, { signal });
    this.shadow.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;
      event.stopPropagation();
      const action = button.dataset.action as Action | undefined;
      if (action) { void this.action(action); return; }
      if (button.dataset.settingsTab) { this.selectSettingsTab(button.dataset.settingsTab); return; }
      const command = button.dataset.command;
      if (command === 'close') this.close();
      else if (command === 'fullscreen') void this.fullscreen();
      else if (command === 'settings') this.toggleSettings();
      else if (command === 'settings-close') this.toggleSettings(false);
      else if (command === 'setting-default') {
        const key = button.dataset.settingKey as NumericSetting;
        if (key && typeof defaultSettings[key] === 'number') {
          this.settings[key] = defaultSettings[key]; this.updateSettingsUI(); this.applySettings(); this.saveSettings();
        }
      }
      else if (command === 'settings-reset') this.resetSettings();
      else if (command) {
        if (!this.adapter.click(command as 'play' | 'previous' | 'next' | 'mute' | 'track' | 'artist')) this.toast('This control is not available yet.');
      }
    }, { signal });
    this.shadow.querySelectorAll<HTMLButtonElement>('.settings-tab').forEach(tab => {
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const tabs = [...this.shadow.querySelectorAll<HTMLButtonElement>('.settings-tab')];
        const index = tabs.indexOf(tab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        this.selectSettingsTab(tabs[next].dataset.settingsTab!);
        tabs[next].focus();
      }, { signal });
    });
    this.shadow.querySelectorAll<HTMLInputElement>('.settings-slider').forEach(slider => {
      slider.addEventListener('input', () => {
        const key = slider.dataset.setting as Exclude<keyof SoundSkySettings, 'heatEnabled' | 'modernSoundCloud'> | undefined;
        if (!key) return;
        const val = Number(slider.value);
        this.settings[key] = val;
        this.updateSettingsUI();
        this.applySettings();
        this.saveSettings();
      }, { signal });
    });
    this.el<HTMLInputElement>('#setting-heatEnabled').addEventListener('change', event => {
      this.settings.heatEnabled = (event.target as HTMLInputElement).checked;
      this.updateSettingsUI(); this.applySettings(); this.saveSettings();
    }, { signal });
    this.el<HTMLInputElement>('#setting-modernSoundCloud').addEventListener('change',event=>{
      this.settings.modernSoundCloud=(event.target as HTMLInputElement).checked;
      this.updateSettingsUI();this.applySettings();this.saveSettings();
    },{signal});
    const seek = this.el<HTMLInputElement>('.seek');
    seek.addEventListener('pointerdown', () => { this.scrubbing = true; this.scrubKey = this.state.track.key; }, { signal });
    seek.addEventListener('input', () => {
      if (!this.scrubbing) { this.scrubbing = true; this.scrubKey = this.state.track.key; }
      seek.style.setProperty('--progress', `${Number(seek.value) / 10}%`);
      this.el('.seek-surface').style.setProperty('--progress', `${Number(seek.value) / 10}%`);
      this.setText('.current', formatTime(Number(seek.value) / 1000 * this.state.duration));
      seek.setAttribute('aria-valuetext', formatTime(Number(seek.value) / 1000 * this.state.duration));
    }, { signal });
    seek.addEventListener('change', () => {
      if (!this.adapter.seek(Number(seek.value) / 1000, this.scrubKey || this.state.track.key)) this.toast('Seek is unavailable for this track.');
      this.scrubbing = false; this.scrubKey = '';
    }, { signal });
    seek.addEventListener('pointercancel', () => { this.scrubbing = false; this.scrubKey = ''; this.adapter.emit(); }, { signal });
    seek.addEventListener('blur', () => { this.scrubbing = false; this.scrubKey = ''; this.adapter.emit(); }, { signal });
    const volume = this.el<HTMLInputElement>('.volume-range');
    volume.addEventListener('input', () => {
      this.volumeEditing = true;
      volume.style.setProperty('--progress', `${Number(volume.value) * 100}%`);
      this.adapter.setVolume(Number(volume.value));
    }, { signal });
    volume.addEventListener('change', () => {
      if (!this.adapter.setVolume(Number(volume.value))) this.toast('Volume is unavailable until SoundCloud loads its player.');
      this.volumeEditing = false;
    }, { signal });
    volume.addEventListener('blur', () => { this.volumeEditing = false; this.adapter.emit(); }, { signal });
    document.addEventListener('keydown', this.keydown, { capture: true, signal });
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      this.el('[data-command="fullscreen"]').setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen');
      if (!on) this.ownsFullscreen = false;
    }, { signal });
    window.addEventListener('pagehide', event => { if (event.persisted) this.close(); else this.destroy(); }, { signal });
    document.addEventListener('visibilitychange', () => { this.adapter.setActive(this.active && !document.hidden); this.syncAnimation(); }, { signal });
    window.addEventListener('focus', () => { if (this.active) { this.adapter.emit(); void this.adapter.probeRepost(true); } }, { signal });
    document.addEventListener('click', event => {
      if (!this.active) return;
      const target = event.target instanceof Element ? event.target.closest('.sc-button-repost') : null;
      if (target) setTimeout(() => { if (this.active && !this.disposed) void this.adapter.probeRepost(true); }, 300);
    }, { signal });
  }
  private keydown = (event: KeyboardEvent) => {
    if (!this.active || event.defaultPrevented) return;
    const target = event.composedPath()[0] as HTMLElement;
    if (target.closest('[data-soundsky-menu]')) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); this.adapter.dismissMenu(); this.el('[data-action="repost"]').focus(); }
      return;
    }
    if (target.closest('[id^="repost-dropdown-"],.repostDropdown,[role="dialog"]') && target.getRootNode() !== this.shadow) return;
    const editing = target.matches('input,textarea,select,[contenteditable="true"]');
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.settingsOpen) { this.toggleSettings(false); return; }
      this.close();
      return;
    }
    if (event.key === 'Tab') {
      const own = [...this.shadow.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]),input:not(:disabled)')]
        .filter(el => el.getBoundingClientRect().width > 0 && !el.closest('[hidden]'));
      const queue = this.queue.focusables();
      const afterQueue = own.findIndex(el => el.dataset.command === 'previous');
      const order = [...own.slice(0, afterQueue), ...queue, ...own.slice(afterQueue)];
      const index = order.indexOf(target);
      if (order.length) { event.preventDefault(); event.stopImmediatePropagation(); order[(index + (event.shiftKey ? -1 : 1) + order.length) % order.length]?.focus(); }
      return;
    }
    if (target.matches('[role="tab"]')) return;
    if (editing || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (event.code === 'Space') { event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) this.adapter.click('play'); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (this.state.duration) this.adapter.seek((this.state.current + (event.key === 'ArrowRight' ? 5 : -5)) / this.state.duration, this.state.track.key);
    }
  };
  private async action(action: Action) {
    if (this.pendingActions.has(action)) return;
    const track: Track = { ...this.state.track };
    this.pendingActions.add(action); this.render(this.state);
    try {
      if (!await this.adapter.perform(action, track)) this.toast('The current track changed or this action is unavailable.');
      else if (action === 'repost') {
        const menu = this.adapter.repostMenu(track.key);
        const bounds = this.el('[data-action="repost"]').getBoundingClientRect();
        menu?.style.setProperty('--sky-menu-left', `${Math.max(12,Math.min(bounds.left,document.documentElement.clientWidth-230))}px`);
        menu?.style.setProperty('--sky-menu-top', `${bounds.bottom+8}px`);
        menu?.querySelector<HTMLElement>('.sc-button-repost')?.focus();
      }
    }
    finally { this.pendingActions.delete(action); this.adapter.emit(); }
  }
  private render(state: PlayerState) {
    if (this.disposed) return;
    const changedTrack = state.track.key !== this.lastTrack;
    if (changedTrack || state.current !== this.state.current || state.playing !== this.state.playing) {
      this.clockCurrent = state.current; this.clockAt = performance.now();
    }
    this.state = state;
    this.transport.sync(state);
    this.syncAnalysis();
    this.el('.player').dataset.playing = String(state.playing);
    this.atmosphere.setPlaying(state.playing);
    if (this.active && state.track.key && !state.actions.repost.available) void this.adapter.probeRepost();
    if (changedTrack) {
      this.coverPulse.reset(); this.sceneFlow.reset();
      this.lastTrack = state.track.key;
      this.scrubbing = false; this.scrubKey = '';
      if (this.active) void this.adapter.probeRepost();
    }
    this.setText('h1', state.track.title);
    this.el('.title-link').title = state.track.key ? `${state.track.title} — open on SoundCloud` : state.track.title;
    this.el<HTMLButtonElement>('.title-link').disabled = !state.track.key;
    this.setText('.artist', state.track.artist);
    this.el<HTMLButtonElement>('.artist').disabled = !state.track.artistKey;
    this.el('.artist').title = state.track.artist;
    if (changedTrack && this.active && !document.hidden && !this.reducedMotion.matches) {
      for (const selector of ['.title-link', '.artist']) this.trackAnimate(this.el(selector),
        [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], 280);
    }
    this.setText('.now-label', state.track.key ? state.playing ? 'NOW PLAYING' : 'PAUSED' : 'SOUNDSKY');
    if (state.track.artwork !== this.lastArt) { this.lastArt = state.track.artwork; this.loadArtwork(state.track.artwork, state.track.title); }
    else if (changedTrack && state.track.artwork) this.el<HTMLImageElement>('.art-image').alt = `${state.track.title} artwork`;
    for (const [command, enabled] of Object.entries({ play: state.canPlay, previous: state.canPrevious, next: state.canNext, mute: state.canVolume })) {
      this.el<HTMLButtonElement>(`[data-command="${command}"]`).disabled = !enabled;
    }
    if (state.playing !== this.lastPlaying) {
      this.lastPlaying = state.playing;
      this.materials.setPlaying(state.playing);
      const glyph = icon(state.playing ? 'pause' : 'play').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      const outline = glyph.replace('>', '><defs><filter id="outline" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="expanded"/><feComposite in="expanded" in2="SourceAlpha" operator="out"/></filter></defs><g filter="url(#outline)">').replace('</svg>', '</g></svg>');
      const toggle = this.el('.play-toggle');
      toggle.style.setProperty('--glyph-mask', `url("data:image/svg+xml,${encodeURIComponent(glyph)}")`);
      toggle.style.setProperty('--glyph-outline', `url("data:image/svg+xml,${encodeURIComponent(outline)}")`);
      this.el('.play-toggle').setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
      this.el('.play-toggle').title = `${state.playing ? 'Pause' : 'Play'} · Space`;
    }
    const mute = this.el('[data-command="mute"]');
    if (state.muted) { this.atmosphere.setLevel(0); }
    const muted = state.muted ? 'true' : 'false';
    if (mute.getAttribute('aria-pressed') !== muted) { mute.setAttribute('aria-pressed', muted); mute.innerHTML = icon(state.muted ? 'mute' : 'volume'); mute.setAttribute('aria-label', state.muted ? 'Unmute' : 'Mute'); }
    for (const action of ['like','repost','follow'] as const) {
      const button = this.el<HTMLButtonElement>(`[data-action="${action}"]`);
      const value = state.actions[action];
      button.disabled = !value.available || this.pendingActions.has(action);
      if (value.selected !== null) button.setAttribute('aria-pressed', String(value.selected)); else button.removeAttribute('aria-pressed');
      button.querySelector('span')!.textContent = action === 'like' ? value.selected ? 'Liked' : 'Like' : action === 'repost' ? value.selected ? 'Reposted' : 'Repost' : value.selected ? 'Following' : 'Follow artist';
      button.title = value.available ? action === 'follow' ? `${state.track.artist}` : state.track.title : `${action === 'repost' ? 'Repost' : action} unavailable for the current track`;
    }
    const seek = this.el<HTMLInputElement>('.seek'); seek.disabled = !state.canSeek;
    if (!this.scrubbing) {
      const ratio = state.duration ? Math.min(1, state.current / state.duration) : 0;
      const value = String(ratio * 1000);
      if (seek.value !== value) seek.value = value;
      seek.style.setProperty('--progress', `${ratio * 100}%`);
      this.el('.seek-surface').style.setProperty('--progress', `${ratio * 100}%`);
      seek.setAttribute('aria-valuetext', `${formatTime(state.current)} of ${formatTime(state.duration)}`);
      this.setText('.current', formatTime(state.current));
    }
    this.setText('.duration', formatTime(state.duration));
    const volume = this.el<HTMLInputElement>('.volume-range'); volume.disabled = !state.canVolume;
    if (!this.volumeEditing) { volume.value = String(state.volume); volume.style.setProperty('--progress', `${state.volume * 100}%`); volume.setAttribute('aria-valuetext', `${Math.round(state.volume * 100)} percent`); }
  }
  private animate = (now: number) => {
    if (!this.active || this.disposed || document.hidden) return;
    if (!this.scrubbing) {
      const current = Math.min(this.state.duration, this.clockCurrent + (this.state.playing ? Math.min(1.25, (now - this.clockAt) / 1000) : 0));
      const ratio = this.state.duration ? current / this.state.duration : 0;
      this.el<HTMLInputElement>('.seek').value = String(ratio * 1000);
      this.el('.seek-surface').style.setProperty('--progress', `${ratio * 100}%`);
      this.setText('.current', formatTime(current));
    }
    if (now - this.audioAt >= 200) { this.materials.setLevel(0); this.atmosphere.setLevel(0); }
    const level = this.state.playing && !this.state.muted && now - this.audioAt < 200 && !this.reducedMotion.matches ? this.audioLevel : 0;
    const target = 1 + (level > 0 ? this.coverPulse.expansion(now, this.settings.pulseMax, this.settings.pulseSensitivity) : 0);
    const dt = this.pulseFrameAt ? Math.min(100, now - this.pulseFrameAt) : 16;
    this.pulseFrameAt = now;
    this.artScale += (target - this.artScale) * (1 - Math.exp(-dt / (target > this.artScale ? 20 : 45)));
    const sway = this.state.playing && !this.reducedMotion.matches ? this.settings.sceneSway * 14 : 0;
    if (this.reducedMotion.matches) { this.swayAmplitude = 0; this.sceneFlow.reset(); }
    this.swayAmplitude += (sway - this.swayAmplitude) * (1 - Math.exp(-dt / (this.state.playing ? 700 : 250)));
    const position = this.state.playing && !this.reducedMotion.matches ? this.sceneFlow.step(dt) : this.sceneFlow.step(0);
    this.setSceneOffset(position.x * this.swayAmplitude, position.y * this.swayAmplitude);
    const artwork = this.el('.artwork');
    artwork.style.setProperty('--beat-scale', String(this.artScale));
    artwork.style.borderRadius = `${6 + this.el('.artwork-frame').clientWidth * Math.max(0, this.artScale - 1) * .3}px`;
    this.animation = requestAnimationFrame(this.animate);
  };
  private setSceneOffset(x: number, y: number) {
    this.queue.setMotion(x, y);
    const style = this.host.style;
    for (const [key, value] of [['--soundsky-scene-x', x], ['--soundsky-scene-y', y]] as const) {
      const next = `${value.toFixed(3)}px`;
      if (Math.abs(value) < .0005) style.removeProperty(key);
      else if (style.getPropertyValue(key) !== next) style.setProperty(key, next);
    }
  }
  private syncAnalysis() {
    const active=!this.disposed&&(this.active||this.settings.modernSoundCloud)&&!document.hidden&&this.state.playing&&!this.state.muted;
    if(active===this.analysisActive)return;this.analysisActive=active;
    window.postMessage({type:'soundsky:analysis',active},location.origin);
  }
  private syncAnimation() {
    cancelAnimationFrame(this.animation);
    const active = this.active && !document.hidden;
    this.atmosphere.setActive(active);
    this.syncAnalysis();
    if (active) this.animation = requestAnimationFrame(this.animate);
    else { this.setSceneOffset(0, 0); this.swayAmplitude = 0; this.coverPulse.reset(); this.sceneFlow.reset(); this.pulseFrameAt = 0; this.audioLevel = 0; this.audioOnset = 0; this.materials.setLevel(0); this.atmosphere.setLevel(0); this.artScale = 1; const artwork = this.shadow.querySelector<HTMLElement>('.artwork'); if (artwork) { artwork.style.setProperty('--beat-scale', '1'); artwork.style.borderRadius = '6px'; } }
  }
  private loadArtwork(url: string, title: string) {
    const generation = ++this.artworkGeneration;
    const display = this.el<HTMLImageElement>('.art-image');
    const placeholder = this.el('.artwork-placeholder');
    this.clearArtworkAnimations();
    this.ambient.setArtwork(url);
    this.accent.setArtwork(url);
    if (!url) { display.hidden = true; placeholder.hidden = false; this.materials.setArtwork(''); display.removeAttribute('src'); this.el('.artwork-frame').style.removeProperty('--art-natural'); return; }
    // SoundCloud offers an explicit 500px artwork rendition. Never assume "original" exists.
    const larger = artworkURL(url.replace(/-t\d+x\d+(?=\.)/, '-t500x500')) || url;
    const image = new Image();
    const commit = () => {
      if (this.disposed || generation !== this.artworkGeneration) return;
      this.clearArtworkAnimations();
      const animate = !display.hidden && !!display.getAttribute('src') && this.active && !document.hidden && !this.reducedMotion.matches;
      if (animate) {
        const outgoing = display.cloneNode() as HTMLImageElement;
        outgoing.className = 'art-transition-outgoing'; outgoing.alt = ''; outgoing.setAttribute('aria-hidden', 'true');
        display.parentElement!.append(outgoing); this.outgoingArtwork = outgoing;
        const animation = this.trackAnimate(outgoing, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], 480);
        animation.finished.then(() => { outgoing.remove(); if (this.outgoingArtwork === outgoing) this.outgoingArtwork = null; }).catch(() => {});
      }
      display.src = image.src; display.alt = `${title} artwork`;
      this.materials.setArtwork(image.src);
      display.hidden = false; placeholder.hidden = true;
      if (animate) this.trackAnimate(display, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], 480);
      this.el('.artwork-frame').style.setProperty('--art-natural', `${Math.min(580, image.naturalWidth || 500)}px`);
      this.ambient.setArtwork(url);
    };
    image.onload = commit;
    image.onerror = () => {
      if (generation !== this.artworkGeneration) return;
      if (image.src !== url) image.src = url;
      else { this.clearTrackAnimations(); display.hidden = true; placeholder.hidden = false; this.materials.setArtwork(''); }
    };
    image.src = larger;
  }
  private trackAnimate(element: HTMLElement, keyframes: Keyframe[], duration: number) {
    for (const animation of this.trackAnimations) if (animation.effect instanceof KeyframeEffect && animation.effect.target === element) { animation.cancel(); this.trackAnimations.delete(animation); }
    const animation = element.animate(keyframes, { duration, easing: 'cubic-bezier(.22,.7,.2,1)' });
    this.trackAnimations.add(animation);
    animation.finished.then(() => this.trackAnimations.delete(animation), () => this.trackAnimations.delete(animation));
    return animation;
  }
  private clearArtworkAnimations() {
    for (const animation of this.trackAnimations) {
      const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
      if (target instanceof Element && target.matches('.art-image,.art-transition-outgoing')) { animation.cancel(); this.trackAnimations.delete(animation); }
    }
    this.outgoingArtwork?.remove(); this.outgoingArtwork = null;
  }
  private clearTrackAnimations() {
    for (const animation of this.trackAnimations) animation.cancel();
    this.trackAnimations.clear(); this.outgoingArtwork?.remove(); this.outgoingArtwork = null;
  }
  toggle() { if (this.active) this.close(); else this.open(); }
  private open() {
    if (this.disposed || this.active) return;
    if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; }
    this.active = true;
    this.syncAnimation();
    this.focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.setAttribute('data-soundsky-open', ''); this.siteTheme.setPlayerOpen(true); this.transport.setOpen(true);
    this.el('.launcher').hidden = true;
    const player = this.el('.player'); player.hidden = false;
    // Inert only the page's main surface, never the native player or its live queue.
    for (const element of document.querySelectorAll<HTMLElement>('body > header,body > main, #content, .header, iframe')) {
      if (element.closest('.playControls') || element.contains(this.adapter.root)) continue;
      this.backgroundInert.set(element, element.inert); element.inert = true;
    }
    const controls = this.adapter.query<HTMLElement>('.playControls__elements');
    if (controls) { this.backgroundInert.set(controls, controls.inert); controls.inert = true; }
    requestAnimationFrame(() => { if (this.active) player.classList.add('is-open'); });
    this.adapter.setActive(!document.hidden); this.ambient.setActive(true); this.materials.setActive(true); this.queue.open();
    void this.adapter.probeRepost(true);
    this.el('[data-command="close"]').focus();
  }
  private close() {
    if (!this.active) return;
    this.active = false;
    this.clearTrackAnimations();
    this.toggleSettings(false);
    this.syncAnimation();
    const player = this.shadow.querySelector<HTMLElement>('.player');
    const launcher = this.shadow.querySelector<HTMLButtonElement>('.launcher');
    player?.classList.remove('is-open');
    this.adapter.dismissMenu();
    this.queue.close(); this.ambient.setActive(false); this.materials.setActive(false); this.adapter.setActive(false);
    document.body.removeAttribute('data-soundsky-open'); this.siteTheme.setPlayerOpen(false); this.transport.setOpen(false);
    document.documentElement.style.overflow = this.previousOverflow;
    for (const [element, inert] of this.backgroundInert) if (element.isConnected) element.inert = inert;
    this.backgroundInert.clear();
    if (this.ownsFullscreen && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    this.ownsFullscreen = false;
    if (!this.disposed) this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      if (player) player.hidden = true;
      if (launcher) launcher.hidden = false;
    }, 240);
    this.focusBefore?.isConnected ? this.focusBefore.focus() : launcher?.focus();
  }
  private toggleSettings(show = !this.settingsOpen) {
    this.settingsOpen = show;
    const panel = this.shadow.querySelector<HTMLElement>('.settings-panel');
    const btn = this.shadow.querySelector<HTMLButtonElement>('[data-command="settings"]');
    if (!panel) {
      this.settingsOpen = false;
      btn?.setAttribute('aria-expanded', 'false');
      return;
    }
    panel.hidden = !this.settingsOpen;
    if (show) panel.showPopover?.();
    else panel.hidePopover?.();
    btn?.setAttribute('aria-expanded', String(this.settingsOpen));
    if (this.settingsOpen) {
      this.updateSettingsUI();
      this.shadow.querySelector<HTMLButtonElement>('.settings-tab[aria-selected="true"]')?.focus();
    } else if (panel.contains(this.shadow.activeElement)) btn?.focus();
  }
  private selectSettingsTab(group: string) {
    this.shadow.querySelectorAll<HTMLButtonElement>('.settings-tab').forEach(tab => {
      const selected = tab.dataset.settingsTab === group;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    });
    this.shadow.querySelectorAll<HTMLElement>('.settings-section').forEach(panel => { panel.hidden = panel.id !== `settings-${group}`; });
  }
  private resetSettings() {
    this.settings = { ...defaultSettings };
    this.updateSettingsUI();
    this.applySettings();
    this.saveSettings();
  }
  private updateSettingsUI() {
    for (const [key, val] of Object.entries(this.settings)) {
      if (typeof val !== 'number') continue;
      const slider = this.shadow.querySelector<HTMLInputElement>(`[data-setting="${key}"]`);
      if (slider) {
        slider.value = String(val);
        const min = Number(slider.min) || 0;
        const max = Number(slider.max) || 1;
        const pct = ((val - min) / (max - min)) * 100;
        slider.style.setProperty('--progress', `${pct}%`);
      }
      const valEl = this.shadow.querySelector(`#val-${key}`);
      if (valEl) {
        valEl.textContent = settingValue(key as NumericSetting, val);
        slider?.setAttribute('aria-valuetext', valEl.textContent);
      }
    }
    this.el<HTMLInputElement>('#setting-modernSoundCloud').checked=this.settings.modernSoundCloud;
    this.el('#val-modernSoundCloud').textContent=this.settings.modernSoundCloud?'オン':'オフ';
    this.el<HTMLInputElement>('#setting-heatEnabled').checked = this.settings.heatEnabled;
    this.el('#val-heatEnabled').textContent = this.settings.heatEnabled ? 'オン' : 'オフ';
    this.el('.settings-heat-controls').classList.toggle('is-disabled', !this.settings.heatEnabled);
    for (const key of ['heatSpeed', 'heatResponse']) {
      this.el<HTMLInputElement>(`#setting-${key}`).disabled = !this.settings.heatEnabled;
      this.el<HTMLButtonElement>(`[data-setting-key="${key}"]`).disabled = !this.settings.heatEnabled;
    }
  }
  private applySettings() {
    this.siteTheme.setEnabled(this.settings.modernSoundCloud);
    this.transport.setEnabled(this.settings.modernSoundCloud);
    this.transport.setSpeeds(this.settings.materialSpeed,this.settings.seekSpeed);
    this.syncAnalysis();
    this.ambient.setFlowSpeed(this.settings.ambientSpeed);
    this.atmosphere.setSettings(this.settings.ambientSpeed, this.settings.ambientGlow, this.settings.consoleSpeed, this.settings.seekSpeed);
    this.materials.setSettings(this.settings.materialSpeed, this.settings.heatSpeed, this.settings.heatEnabled, this.settings.heatResponse);
  }
  private async loadSettings() {
    try {
      let saved: Partial<SoundSkySettings> | undefined;
      if (globalThis.chrome?.storage?.local) {
        saved = (await chrome.storage.local.get('soundsky:settings'))?.['soundsky:settings'] as Partial<SoundSkySettings> | undefined;
      } else {
        const raw = localStorage.getItem('soundsky:settings');
        if (raw) saved = JSON.parse(raw);
      }
      this.settings = loadSavedSettings(saved);
    } catch { /* use defaults */ }
    if (this.disposed) return;
    this.updateSettingsUI();
    this.applySettings();
  }
  private saveSettings() {
    try {
      if (globalThis.chrome?.storage?.local) {
        void chrome.storage.local.set({ 'soundsky:settings': this.settings }).catch(() => {});
      } else {
        localStorage.setItem('soundsky:settings', JSON.stringify(this.settings));
      }
    } catch { /* ignore storage error */ }
  }
  private async fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen(); this.ownsFullscreen = true; }
    } catch { this.toast('Fullscreen is unavailable in this browser window.'); }
  }
  private toast(message: string) {
    const toast = this.el('.toast'); toast.textContent = message; toast.hidden = false;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { toast.hidden = true; this.toastTimer = null; }, 3800);
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true; this.syncAnalysis(); this.close();
    if (this.closeTimer) clearTimeout(this.closeTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.artworkGeneration++; this.clearTrackAnimations(); this.events.abort(); this.unsubscribe();
    this.nativeModalObserver.disconnect(); this.queue.destroy(); this.ambient.destroy(); this.atmosphere.destroy(); this.materials.destroy(); this.accent.destroy(); this.siteTheme.destroy(); this.transport.destroy(); this.adapter.destroy();
    try { if (globalThis.chrome?.runtime?.id) chrome.runtime.onMessage.removeListener(this.message); } catch { /* extension was reloaded */ }
    this.host.remove();
  }
}

// Reinjection has one instance, one root observer and one bounded animation loop.
if (window.__soundsky?.version !== VERSION) window.__soundsky?.destroy();
if (!window.__soundsky) {
  const player = new SoundSky();
  window.__soundsky = { version: VERSION, toggle: () => player.toggle(), destroy: () => { player.destroy(); delete window.__soundsky; } };
  if (location.hash === '#soundsky') {
    history.replaceState(history.state, '', location.pathname + location.search);
    player.toggle();
  }
}
