import { loadSavedSettings } from './settings';
import { SiteTheme } from './site-theme';
// Page frames get the skin, never a second SoundSky player or audio hook.
if(window!==window.top && (!location.pathname.startsWith('/n/embeds/')||location.pathname==='/n/embeds/credit-tracker')){
 const theme=new SiteTheme(false,false);
 const events=new AbortController();
 let disposed=false;
 let updated=false;
 const changed=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{
  if(!disposed&&area==='local'&&changes['soundsky:settings']){
   updated=true;
   const settings=loadSavedSettings(changes['soundsky:settings'].newValue);
   theme.setPreferences(settings);theme.setEnabled(settings.modernSoundCloud);
  }
 };
 // The parent may deliver current preferences before the initial storage read.
 // SiteTheme applies this packet; only prevent the older read from undoing it.
 window.addEventListener('message',event=>{
  if(event.origin===location.origin&&event.source===window.parent&&event.data?.type==='soundsky:site-theme'&&
    (typeof event.data.enabled==='boolean'||(event.data.settings&&typeof event.data.settings==='object')))updated=true;
 },{signal:events.signal});
 let removeStorageListener=()=>{};
 const dispose=()=>{if(disposed)return;disposed=true;events.abort();removeStorageListener();theme.destroy();};
 // Sandboxed Artist Studio frames can lack extension APIs; the parent packet still supplies the theme.
 try{
  const storage=globalThis.chrome?.storage;
  storage?.onChanged?.addListener(changed);
  removeStorageListener=()=>{try{storage?.onChanged?.removeListener(changed);}catch{/* extension reloaded */}};
  if(storage?.local?.get)void storage.local.get('soundsky:settings').then(result=>{
   if(!disposed&&!updated){const settings=loadSavedSettings(result['soundsky:settings']);theme.setPreferences(settings);theme.setEnabled(settings.modernSoundCloud);}
  }).catch(()=>{});
 }catch{/* parent theme messages remain available */}
 document.addEventListener('soundsky:theme-dispose',dispose,{signal:events.signal});
 window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{signal:events.signal});
}
