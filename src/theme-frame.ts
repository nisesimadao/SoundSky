import { loadSavedSettings } from './settings';
import { SiteTheme } from './site-theme';
// Page frames get the skin, never a second SoundSky player or audio hook.
if(window!==window.top && !location.pathname.startsWith('/n/embeds/')){
 const theme=new SiteTheme(false);
 const events=new AbortController();
 let disposed=false;
 const changed=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{
  if(area==='local'&&changes['soundsky:settings'])theme.setEnabled(loadSavedSettings(changes['soundsky:settings'].newValue).modernSoundCloud);
 };
 chrome.storage.onChanged.addListener(changed);
 void chrome.storage.local.get('soundsky:settings').then(result=>{if(!disposed)theme.setEnabled(loadSavedSettings(result['soundsky:settings']).modernSoundCloud);}).catch(()=>{});
 const dispose=()=>{disposed=true;events.abort();chrome.storage.onChanged.removeListener(changed);theme.destroy();};
 document.addEventListener('soundsky:theme-dispose',dispose,{signal:events.signal});
 window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{signal:events.signal});
}
