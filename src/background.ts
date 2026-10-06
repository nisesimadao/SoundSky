async function toggle(tab: chrome.tabs.Tab) {
  if (!tab.id || !tab.url || !/^https:\/\/(www\.)?soundcloud\.com\//.test(tab.url)) {
    await chrome.tabs.create({ url: 'https://soundcloud.com/#soundsky' });
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'soundsky:toggle' });
  } catch {
    // Already-open tabs and extension reloads need a fresh isolated-world entry.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, { type: 'soundsky:toggle' });
  }
}
chrome.action.onClicked.addListener(tab => { void toggle(tab).catch(() => {
  if (tab.id) void chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
}); });
