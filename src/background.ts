import { VERSION } from './version';

async function toggle(tab: chrome.tabs.Tab) {
  if (!tab.id || !tab.url || !/^https:\/\/(www\.)?soundcloud\.com\//.test(tab.url)) {
    await chrome.tabs.create({ url: 'https://soundcloud.com/discover#soundsky' });
    return;
  }
  const tabId = tab.id;
  let status: { version?: string } | undefined;
  try { status = await chrome.tabs.sendMessage(tabId, { type: 'soundsky:status' }); } catch { /* not loaded yet */ }
  if (status?.version !== VERSION) {
    // Tabs opened before installation/update need both execution worlds. The
    // versioned bridge is idempotent and restores its old hooks before replacing them.
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['audio.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }
  await chrome.tabs.sendMessage(tabId, { type: 'soundsky:toggle' });
  await chrome.action.setBadgeText({ tabId, text: '' });
  await chrome.action.setTitle({ tabId, title: 'Open SoundSky' });
}
// Repeated clicks keep their open/close order even while a tab is being recovered.
const pending = new Map<number, Promise<void>>();
chrome.action.onClicked.addListener(tab => {
  const id = tab.id ?? -1;
  const next = (pending.get(id) ?? Promise.resolve()).then(() => toggle(tab)).catch(async () => {
    if (!tab.id) return;
    try {
      await chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
      await chrome.action.setTitle({ tabId: tab.id, title: 'SoundSkyを開けませんでした。ページを再読み込みして再試行してください。' });
    } catch { /* the tab may have closed */ }
  }).finally(() => { if (pending.get(id) === next) pending.delete(id); });
  pending.set(id, next);
});
