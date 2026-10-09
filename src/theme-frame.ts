import { loadSavedSettings } from './settings';
import { SiteTheme } from './site-theme';
// Page frames get the skin, never a second SoundSky player or audio hook.
if(window!==window.top && (!location.pathname.startsWith('/n/embeds/')||location.pathname==='/n/embeds/credit-tracker')){
 const theme=new SiteTheme(false,false);
 const events=new AbortController();
 let disposed=false;
 const changed=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{
  if(area==='local'&&changes['soundsky:settings'])theme.setEnabled(loadSavedSettings(changes['soundsky:settings'].newValue).modernSoundCloud);
 };
 let removeStorageListener=()=>{};
 const dispose=()=>{if(disposed)return;disposed=true;events.abort();removeStorageListener();theme.destroy();};
 // Sandboxed Artist Studio frames can lack extension APIs; the parent packet still supplies the theme.
 try{
  const storage=globalThis.chrome?.storage;
  storage?.onChanged?.addListener(changed);
  removeStorageListener=()=>{try{storage?.onChanged?.removeListener(changed);}catch{/* extension reloaded */}};
  if(storage?.local?.get)void storage.local.get('soundsky:settings').then(result=>{
   if(!disposed)theme.setEnabled(loadSavedSettings(result['soundsky:settings']).modernSoundCloud);
  }).catch(()=>{});
 }catch{/* parent theme messages remain available */}
 document.addEventListener('soundsky:theme-dispose',dispose,{signal:events.signal});
 window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();},{signal:events.signal});
}
