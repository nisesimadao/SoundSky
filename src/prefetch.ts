/** Session-only audio lookahead. Use only streams authorized by SoundCloud's own broker. */
interface Transcoding { url: string; format: { protocol: string; mime_type: string }; quality: string; snipped?: boolean; }
interface Metadata { artwork_url?: string; permalink_url: string; streamable: boolean; policy: string; track_authorization?: string; media: { transcodings: Transcoding[] }; }
const CAP = 24 * 1024 * 1024, TTL = 15 * 60 * 1000;
const apiURL = (value: string) => { try { const u=new URL(value);return u.origin==='https://api-v2.soundcloud.com'&&!u.username&&!u.password ? u : null; } catch { return null; } };
const mediaURL = (value: string) => { try { const u=new URL(value);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(/(^|\.)sndcdn\.com$/.test(u.hostname)||u.hostname==='playback.media-streaming.soundcloud.cloud') ? u : null; } catch { return null; } };
const trackKey = (value: string) => { try { const u=new URL(value,'https://soundcloud.com');return u.protocol==='https:'&&/^(www\.)?soundcloud\.com$/.test(u.hostname)&&/^\/[^/]+\/[^/]+\/?$/.test(u.pathname)?u.pathname.replace(/\/$/,''):''; } catch { return ''; } };
export class AudioPrefetch {
  private nativeFetch = window.fetch;
  private hook: typeof window.fetch;
  private events = new AbortController();
  private metadata = new Map<string, Metadata>();
  private cache = new Map<string, { response: Response; bytes: number; at: number; owner: string }>();
  private cachedXHR = new Set<XMLHttpRequest>();
  private artwork = new Map<string, HTMLImageElement>();
  private bytes = 0;
  private headers = new Headers();
  private params = new URLSearchParams();
  private preparedFormats = new Map<string, string>();
  private preferred: { protocol: string; mime: string; quality: string } | null = null;
  private aliases = new Map<string, string>();
  private current = '';
  private count = 0;
  private seconds = 0;
  private playing = false;
  private next: string[] = [];
  private ready = new Set<string>();
  private progress = new Map<string, number>();
  private controller: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private foreground = 0;
  private disposed = false;
  private revision = 0;
  private retryAt = 0;
  private issue: 'capacity'|'unavailable'|null = null;
  private xhrOpen = XMLHttpRequest.prototype.open;
  private xhrSend = XMLHttpRequest.prototype.send;
  private xhrHeader = XMLHttpRequest.prototype.setRequestHeader;
  private xhrAbort = XMLHttpRequest.prototype.abort;
  private abortHook: XMLHttpRequest['abort'];
  private openHook: XMLHttpRequest['open'];
  private sendHook: XMLHttpRequest['send'];
  private headerHook: XMLHttpRequest['setRequestHeader'];
  private requests = new WeakMap<XMLHttpRequest, { url: string; headers: Headers; method: string; async: boolean; aborted?: boolean; blobURL?: string; listener?: EventListener }>();
  constructor() {
    const owner = this;
    this.hook = async function(input, init) {
      // Inspect request options without consuming or cloning a native POST body.
      const original = input instanceof Request ? input : null;
      const request = { url:new URL(original?.url || String(input),location.href).href, method:(init?.method || original?.method || 'GET').toUpperCase(), headers:new Headers(init?.headers || original?.headers), cache:init?.cache || original?.cache, signal:init?.signal || original?.signal };
      if (owner.disposed) return owner.nativeFetch.call(window,input,init);
      owner.observeRequest(request.url, request.headers);
      const key = owner.key(request.url, request.headers);
      const cached = request.method==='GET'&&request.cache!=='reload'&&request.cache!=='no-store' ? owner.cache.get(key) || (!request.headers.has('range') ? owner.cache.get(owner.aliases.get(request.url)||'') : undefined) : null;
      if (cached && Date.now()-cached.at<TTL) {
        if (request.signal?.aborted) throw new DOMException('Aborted','AbortError');
        return owner.copy(cached.response);
      }
      const audio = !!mediaURL(request.url) || !!apiURL(request.url)?.pathname.startsWith('/media/');
      if (audio) { owner.foreground++; if(owner.controller)owner.stop(); owner.status(); }
      try {
        const response = await owner.nativeFetch.call(window,input,init);
        if (apiURL(request.url))try {
          const inspection=owner.inspect(response.clone(),request.url);
          // A broker's fresh signature must be mapped before native code requests its manifest.
          if(apiURL(request.url)!.pathname.startsWith('/media/'))await inspection;else void inspection;
        } catch { /* a third-party fetch wrapper may already have consumed it */ }
        return response;
      } finally { if(audio){owner.foreground--;owner.schedule();owner.status();} }
    };
    window.fetch = this.hook;
    this.openHook = function(this: XMLHttpRequest, ...args: unknown[]) {
      owner.cachedXHR.delete(this);
      const previousInfo=owner.requests.get(this);
      if(previousInfo){previousInfo.aborted=true;if(previousInfo.blobURL)URL.revokeObjectURL(previousInfo.blobURL);}
      if(previousInfo?.blobURL)delete (this as unknown as Record<string, unknown>).responseURL;
      const result=Reflect.apply(owner.xhrOpen,this,args);
      const previous=owner.requests.get(this)?.listener;if(previous)this.removeEventListener('readystatechange',previous,true);
      if (!owner.disposed) owner.requests.set(this,{url:new URL(String(args[1]),location.href).href,method:String(args[0]).toUpperCase(),async:args[2]!==false,headers:new Headers()});
      return result;
    } as XMLHttpRequest['open'];
    this.headerHook = function(this: XMLHttpRequest,name,value) {
      const result=owner.xhrHeader.call(this,name,value);owner.requests.get(this)?.headers.append(name,value);return result;
    };
    this.sendHook = function(this: XMLHttpRequest,...args) {
      const info=owner.requests.get(this);
      if (!owner.disposed && info && info.method === 'GET' && info.async && mediaURL(info.url) && !info.headers.has('range')) {
        const hit=owner.cache.get(owner.key(info.url,info.headers))||owner.cache.get(owner.aliases.get(info.url)||'');
        if(hit&&Date.now()-hit.at<TTL){
          // Let a real native XHR deliver cached bytes, preserving its events and response types.
          if(owner.cachedXHR.has(this))throw new DOMException('Request already sent','InvalidStateError');
          owner.cachedXHR.add(this);
          const type=this.responseType,timeout=this.timeout,credentials=this.withCredentials;
          void hit.response.clone().blob().then(blob=>{
            if(owner.disposed||info.aborted||owner.requests.get(this)!==info)return;
            const blobURL=URL.createObjectURL(blob);info.blobURL=blobURL;
            Reflect.apply(owner.xhrOpen,this,['GET',blobURL,true]);
            this.responseType=type;this.timeout=timeout;this.withCredentials=credentials;
            Object.defineProperty(this,'responseURL',{configurable:true,get:()=>hit.response.url});
            this.addEventListener('loadend',()=>{URL.revokeObjectURL(blobURL);if(owner.requests.get(this)===info)owner.cachedXHR.delete(this);},{once:true});
            Reflect.apply(owner.xhrSend,this,args);
          }).catch(()=>{if(!info.aborted&&owner.requests.get(this)===info)Reflect.apply(owner.xhrSend,this,args);});
          return;
        }
      }
      if(!owner.disposed&&info&&(mediaURL(info.url)||apiURL(info.url)?.pathname.startsWith('/media/'))){
        owner.foreground++;if(owner.controller)owner.stop();owner.status();
        this.addEventListener('loadend',()=>{owner.foreground--;owner.schedule();owner.status();},{once:true});
      }
      if (!owner.disposed&&info&&apiURL(info.url)) {
        owner.observeRequest(info.url,info.headers);
        const listener:EventListener=()=>{
          if(this.readyState!==4)return;
          this.removeEventListener('readystatechange',listener,true);info.listener=undefined;
          if(owner.disposed||this.status<200||this.status>=300)return;
          try { if(this.responseType==='json')owner.readAPI(this.response,info.url);else if(!this.responseType||this.responseType==='text') { if(this.responseText.length<3*1024*1024)owner.readAPI(JSON.parse(this.responseText),info.url); } } catch { /* non-JSON */ }
        };
        info.listener=listener;this.addEventListener('readystatechange',listener,{capture:true,signal:owner.events.signal});
      }
      return Reflect.apply(owner.xhrSend,this,args);
    };
    this.abortHook=function(this:XMLHttpRequest){const info=owner.requests.get(this);if(info){info.aborted=true;if(info.blobURL)URL.revokeObjectURL(info.blobURL);}owner.cachedXHR.delete(this);return owner.xhrAbort.call(this);};
    XMLHttpRequest.prototype.abort=this.abortHook;
    XMLHttpRequest.prototype.open=this.openHook;XMLHttpRequest.prototype.send=this.sendHook;XMLHttpRequest.prototype.setRequestHeader=this.headerHook;
    const signal=this.events.signal;
    window.addEventListener('message',event=>{
      if(event.source!==window||event.origin!==location.origin||event.data?.type!=='soundsky:prefetch')return;
      const {count,playing,next,current,seconds}=event.data;
      if(typeof seconds!=='number'||![0,15,30,60,120].includes(seconds)||typeof current!=='string'||(current&&trackKey(current)!==current)||!Number.isInteger(count)||count<0||count>3||typeof playing!=='boolean'||!Array.isArray(next)||next.length>3||!next.every(key=>typeof key==='string'&&trackKey(key)===key))return;
      this.configure(count,playing,next,current,seconds);
    },{signal});
    const hydration=()=>{for(const script of document.querySelectorAll('script:not([src])')){const text=script.textContent||'';if(text.length>3*1024*1024)continue;const match=text.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);/s);if(match)try{this.collect(JSON.parse(match[1]));}catch{/* changed hydration */}}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydration,{once:true,signal});else hydration();
    window.addEventListener('offline',()=>{this.stop();this.status();},{signal});
    window.addEventListener('online',()=>{this.retryAt=0;this.schedule();},{signal});
  }
  private key(value: string, headers: Headers) { const url=new URL(value);url.searchParams.sort();return url.href+'\n'+(apiURL(value)?headers.get('authorization')||'':'')+'\n'+(headers.get('range')||''); }
  private observeRequest(value: string, headers: Headers) {
    const url=apiURL(value);if(!url)return;
    // Credentials remain inside this page's bridge and are never sent to a CDN or UI.
    if(url.searchParams.has('client_id')) {
      this.params=new URLSearchParams();for(const name of ['client_id','app_version','app_locale']) { const value=url.searchParams.get(name);if(value)this.params.set(name,value); }
      this.headers=new Headers();const authorization=headers.get('authorization');if(authorization)this.headers.set('authorization',authorization);
    }
    if(url.pathname.startsWith('/media/'))for(const meta of this.metadata.values())for(const t of meta.media.transcodings)if(new URL(t.url).pathname===url.pathname){
      const preferred={protocol:t.format.protocol,mime:t.format.mime_type,quality:t.quality};
      if(JSON.stringify(preferred)!==JSON.stringify(this.preferred)){
        let invalidated=false;
        for(const key of new Set([...this.ready,...this.progress.keys()]))if(this.preparedFormats.get(key)!==JSON.stringify(preferred)){this.ready.delete(key);this.progress.delete(key);invalidated=true;}
        if(invalidated){this.stop();this.status();}
      }
      this.preferred=preferred;
    }
    this.schedule();
  }
  private async inspect(response: Response, url: string) {
    try { if(!response.ok||!apiURL(response.url))return;const size=Number(response.headers.get('content-length'));if(size>3*1024*1024)return;const text=await response.text();if(text.length<3*1024*1024&&!this.disposed)this.readAPI(JSON.parse(text),url); } catch { /* native response unchanged */ }
  }
  private readAPI(data: unknown, url: string) {
    this.collect(data);
    if(!apiURL(url)?.pathname.startsWith('/media/')||!data||typeof data!=='object')return;
    const stream=(data as {url?:unknown}).url;if(typeof stream!=='string'||!mediaURL(stream))return;
    // Only a successful native broker response authorizes a newly signed URL.
    // Match the immutable CDN path and the exact transcoding's owner, retaining signatures elsewhere.
    const path=apiURL(url)!.pathname;
    const owner=[...this.metadata].find(([,meta])=>meta.media.transcodings.some(t=>apiURL(t.url)?.pathname===path))?.[0];
    if(!owner)return;
    const next=mediaURL(stream)!;
    for(const [key,entry] of this.cache) {
      const old=mediaURL(entry.response.url);
      if(entry.owner===owner&&old&&old.origin===next.origin&&old.pathname===next.pathname&&Date.now()-entry.at<TTL)this.aliases.set(stream,key);
    }
  }
  private collect(value: unknown, depth=0) {
    if(this.disposed||depth>7||!value||typeof value!=='object')return;
    if(Array.isArray(value)){for(const item of value.slice(0,300))this.collect(item,depth+1);return;}
    const data=value as Record<string,unknown>, meta=data as unknown as Metadata;
    if(typeof meta.permalink_url==='string') {
      const key=trackKey(meta.permalink_url);
      if(key&&(meta.streamable===false||(typeof meta.policy==='string'&&meta.policy!=='ALLOW'))) {
        this.metadata.delete(key);this.artwork.delete(key);this.ready.delete(key);this.progress.delete(key);
        this.preparedFormats.delete(key);
        for(const [cacheKey,item]of this.cache)if(item.owner===key){this.bytes-=item.bytes;this.cache.delete(cacheKey);}
        this.status();
      }
      if(key&&meta.streamable===true&&meta.policy==='ALLOW'&&meta.media&&Array.isArray(meta.media.transcodings)) {
        const transcodings=meta.media.transcodings.slice(0,10).filter(t=>typeof t?.url==='string'&&apiURL(t.url)?.pathname.startsWith('/media/')&&typeof t.format?.protocol==='string'&&typeof t.format?.mime_type==='string'&&!t.snipped);
        this.metadata.set(key,{artwork_url:typeof meta.artwork_url==='string'&&mediaURL(meta.artwork_url)?.hostname.endsWith('sndcdn.com')?meta.artwork_url:undefined,permalink_url:meta.permalink_url,streamable:true,policy:'ALLOW',track_authorization:typeof meta.track_authorization==='string'?meta.track_authorization:undefined,media:{transcodings}});
        while(this.metadata.size>300)this.metadata.delete(this.metadata.keys().next().value!);
        this.schedule();
      }
    }
    for(const name of ['collection','tracks','data'])if(name in data)this.collect(data[name],depth+1);
  }
  configure(count: number, playing: boolean, next: string[], current='', seconds=0) {
    let expired=false;
    for(const [key,item]of this.cache)if(Date.now()-item.at>=TTL){this.bytes-=item.bytes;this.cache.delete(key);this.ready.delete(item.owner);this.progress.delete(item.owner);expired=true;}
    for(const [url,key]of this.aliases)if(!this.cache.has(key))this.aliases.delete(url);
    const scopeChanged=seconds!==this.seconds;
    const changed=scopeChanged||current!==this.current||count!==this.count||playing!==this.playing||JSON.stringify(next)!==JSON.stringify(this.next);
    if(!changed){if(expired){this.trimFormatRecords();this.retryAt=0;this.status();this.schedule();}return;}
    this.retryAt=0;this.issue=null;this.seconds=seconds;if(scopeChanged){this.ready.clear();this.progress.clear();}this.current=current;this.count=count;this.playing=playing;this.next=[...new Set(next)].slice(0,count);this.stop();
    // Queue/title updates can arrive separately. Keep prepared bytes through those transitions.
    if(!count){this.preparedFormats.clear();this.artwork.clear();this.cache.clear();this.aliases.clear();this.ready.clear();this.progress.clear();this.bytes=0;}
    this.trimFormatRecords();
    this.status();this.schedule();
  }
  private trimFormatRecords() {
    // Keep the format while its bytes can still be reused, including promotion
    // to the current track. Failed preparations need only the active queue.
    const retained=new Set([this.current,...this.next,...Array.from(this.cache.values(),entry=>entry.owner)]);
    for(const key of this.preparedFormats.keys())if(!retained.has(key))this.preparedFormats.delete(key);
  }
  private status() {
    if(this.disposed)return;
    const readyKeys=[...this.ready].filter(key=>this.next.includes(key)),ready=readyKeys.length,total=this.next.length;
    const phase=!navigator.onLine?'offline':this.foreground?'playback':total&&ready===total?'ready':this.controller?'loading':this.issue||(!this.params.has('client_id')?'metadata':'waiting');
    window.postMessage({type:'soundsky:prefetch-status',ready,readyKeys,progress:this.next.map(key=>({key,value:this.ready.has(key)?1:this.progress.get(key)||0})),total,seconds:this.seconds,phase},location.origin);
  }

  private reportProgress(key: string, value: number, signal: AbortSignal) {
    if (this.disposed || signal.aborted || !this.next.includes(key)) return;
    const next = Math.min(0.99, Math.floor(value * 100) / 100);
    if (next !== this.progress.get(key)) { this.progress.set(key,next); this.status(); }
  }
  private stop() { this.revision++;this.controller?.abort();this.controller=null;if(this.timer)clearTimeout(this.timer);this.timer=null; }
  private schedule() {
    if(this.disposed||Date.now()<this.retryAt||this.timer||this.controller||!this.count||!navigator.onLine||!this.next.some(key=>!this.ready.has(key))||!this.params.has('client_id'))return;
    this.timer=setTimeout(()=>{this.timer=null;void this.run();},1500);
  }
  private async run() {
    if(this.foreground){this.schedule();return;}
    const generation=this.revision,controller=new AbortController();this.controller=controller;
    this.issue=null;this.status();
    try {
      for(const key of this.next) {
        if(this.ready.has(key))continue;
        try {
          await this.prepare(key,controller.signal);
          if(this.disposed||generation!==this.revision)return;
          this.ready.add(key);this.status();
        } catch(error) {
          if(controller.signal.aborted){this.progress.delete(key);throw error;}
          this.retryAt=Date.now()+60000;
          this.issue=error instanceof Error&&error.message==='Cache full'?'capacity':'unavailable';
          this.status();if(this.issue==='capacity')break;
        }
      }
    } catch (error) {
      if(!controller.signal.aborted){this.retryAt=Date.now()+60000;this.issue=error instanceof Error&&error.message==='Cache full'?'capacity':'unavailable';}
    } finally { if(this.controller===controller)this.controller=null;this.trimFormatRecords();this.status(); }
  }
  private makeSpace(required: number) {
    if(required<=CAP-this.bytes)return;
    for(const [cacheKey,item]of this.cache){
      if(item.owner===this.current||this.next.includes(item.owner))continue;
      this.bytes-=item.bytes;this.cache.delete(cacheKey);this.ready.delete(item.owner);this.progress.delete(item.owner);this.artwork.delete(item.owner);
      if(required<=CAP-this.bytes)break;
    }
  }
  private async get(url: string, owner: string, signal: AbortSignal, headers=new Headers(),progress?: (value:number)=>void): Promise<Response> {
    if(!mediaURL(url)&&!apiURL(url)?.pathname.startsWith('/media/'))throw new Error('Unsupported stream');
    const key=this.key(url,headers),hit=this.cache.get(key);
    if(hit&&Date.now()-hit.at<TTL){progress?.(1);return this.copy(hit.response);}
    if(hit){this.bytes-=hit.bytes;this.cache.delete(key);}
    if(this.foreground)throw new Error('Playback takes priority');
    const response=await this.nativeFetch.call(window,url,{signal,headers,credentials:'omit',priority:'low'} as RequestInit);
    if(!response.ok||response.type==='opaque'||(!mediaURL(response.url)&&!apiURL(response.url)?.pathname.startsWith('/media/')))throw new Error('Unavailable stream');
    const length=Number(response.headers.get('content-length'));
    this.makeSpace(length);
    if(length>CAP-this.bytes)throw new Error('Cache full');
    const reader=response.body?.getReader(),parts:Uint8Array[]=[];let bytes=0;
    if(reader)try {
      while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;this.makeSpace(bytes);if(bytes+this.bytes>CAP){void reader.cancel().catch(()=>{});throw new Error('Cache full');}parts.push(part.value);if(length>0)progress?.(Math.min(0.99,bytes/length));}
    } finally { reader.releaseLock(); }
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    const body=new Uint8Array(bytes);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.byteLength;}
    const stored=new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
    for(const name of ['url','type','redirected'] as const)Object.defineProperty(stored,name,{value:response[name]});
    this.cache.set(key,{response:stored,bytes,at:Date.now(),owner});this.bytes+=bytes;progress?.(1);return this.copy(stored);
  }
  private copy(response:Response) {
    const clone=response.clone();for(const name of ['url','type','redirected'] as const)Object.defineProperty(clone,name,{value:response[name],configurable:true});return clone;
  }

  private async prepare(key: string, signal: AbortSignal) {
    if(!this.metadata.has(key)) {
      const page=await this.nativeFetch.call(window,'https://soundcloud.com'+key,{signal,credentials:'same-origin',priority:'low'} as RequestInit);
      if(!page.ok||!/^https:\/\/(www\.)?soundcloud\.com\//.test(page.url))throw new Error('Unavailable track');
      const text=await page.text(),hydration=text.match(/window\.__sc_hydration\s*=\s*(\[.*?\]);/s);
      if(hydration)try { this.collect(JSON.parse(hydration[1])); } catch { /* changed page format */ }
    }
    const meta=this.metadata.get(key);if(meta?.artwork_url&&!this.artwork.has(key)){const image=new Image();image.onerror=()=>{if(this.artwork.get(key)===image)this.artwork.delete(key);};image.src=meta.artwork_url.replace(/-(?:t\d+x\d+|large)(?=\.)/,'-t500x500');this.artwork.set(key,image);while(this.artwork.size>8)this.artwork.delete(this.artwork.keys().next().value!);}
    if(!meta)throw new Error('No authorized track metadata');
    const t=meta.media.transcodings.find(t=>t.format.protocol===this.preferred?.protocol&&t.format.mime_type===this.preferred?.mime&&t.quality===this.preferred?.quality)
      ||meta.media.transcodings.find(t=>t.format.protocol==='hls'&&t.format.mime_type.includes('audio/mp4')&&t.quality==='sq');
    if(!t)throw new Error('Unsupported audio format');
    this.preparedFormats.set(key,JSON.stringify({protocol:t.format.protocol,mime:t.format.mime_type,quality:t.quality}));
    const resolver=new URL(t.url);for(const [name,value]of this.params)resolver.searchParams.set(name,value);if(meta.track_authorization)resolver.searchParams.set('track_authorization',meta.track_authorization);
    const result=await (await this.get(resolver.href,key,signal,this.headers)).json();if(typeof result.url!=='string'||!mediaURL(result.url))throw new Error('Unavailable audio URL');
    if(t.format.protocol==='progressive'){if(this.seconds)throw new Error('Duration-limited progressive preparation is unsupported');await this.get(result.url,key,signal,new Headers(),value=>this.reportProgress(key,value,signal));return;}
    await this.playlist(result.url,key,signal,0);
  }
  private async playlist(url: string, key: string, signal: AbortSignal, depth: number, start=0, span=1): Promise<void> {
    if(depth>2)throw new Error('Nested playlist');
    const text=await (await this.get(url,key,signal)).text();if(!text.startsWith('#EXTM3U')||/#EXT-X-KEY:(?!METHOD=NONE)/.test(text)||text.includes('#EXT-X-BYTERANGE'))throw new Error('Unsupported HLS');
    const lines=text.split(/\r?\n/),files=lines.map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')).map(line=>new URL(line,url).href);
    if(!files.length||files.length>400)throw new Error('Unsupported playlist size');
    if(text.includes('#EXT-X-STREAM-INF')) { for(let i=0;i<files.length;i++)await this.playlist(files[i],key,signal,depth+1,start+span*i/files.length,span/files.length);return; }
    if(!text.includes('#EXT-X-ENDLIST'))throw new Error('Live streams are not prefetched');
    for(const line of lines)if(line.startsWith('#EXT-X-MAP:')){const map=line.match(/URI="([^"]+)"/);if(!map||line.includes('BYTERANGE'))throw new Error('Unsupported init segment');await this.get(new URL(map[1],url).href,key,signal);}
    const durations=[...text.matchAll(/^#EXTINF:([\d.]+)/gm)].map(match=>Number(match[1]));
    if(this.seconds&&(durations.length!==files.length||durations.some(value=>!Number.isFinite(value)||value<=0)))throw new Error('Unknown segment duration');
    let elapsed=0, total=files.length;
    if(this.seconds)for(let i=0;i<files.length;i++){elapsed+=durations[i];if(elapsed>=this.seconds){total=i+1;break;}}
    for(let i=0;i<total;i++)await this.get(files[i],key,signal,new Headers(),value=>this.reportProgress(key,start+span*(i+value)/total,signal));
  }
  destroy() {
    if(this.disposed)return;this.stop();this.disposed=true;for(const xhr of this.cachedXHR)xhr.abort();this.cachedXHR.clear();this.events.abort();this.preparedFormats.clear();this.artwork.clear();this.cache.clear();this.aliases.clear();this.metadata.clear();this.ready.clear();this.progress.clear();this.bytes=0;this.headers=new Headers();this.params=new URLSearchParams();this.requests=new WeakMap();
    if(window.fetch===this.hook)window.fetch=this.nativeFetch;
    if(XMLHttpRequest.prototype.abort===this.abortHook)XMLHttpRequest.prototype.abort=this.xhrAbort;
    if(XMLHttpRequest.prototype.open===this.openHook)XMLHttpRequest.prototype.open=this.xhrOpen;
    if(XMLHttpRequest.prototype.send===this.sendHook)XMLHttpRequest.prototype.send=this.xhrSend;
    if(XMLHttpRequest.prototype.setRequestHeader===this.headerHook)XMLHttpRequest.prototype.setRequestHeader=this.xhrHeader;
  }
}
