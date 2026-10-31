// Observe only explicit context registrations; this file is never bundled into the extension.
(() => {
 const contexts=new Map(),prototype=BaseAudioContext.prototype,add=prototype.addEventListener,remove=prototype.removeEventListener;
 let peak=0;
 prototype.addEventListener=function(type,callback,...args){
  const result=Reflect.apply(add,this,[type,callback,...args]);
  if(type==='statechange'){const listeners=contexts.get(this)||new Set();listeners.add(callback);contexts.set(this,listeners);peak=Math.max(peak,[...contexts.values()].reduce((sum,set)=>sum+set.size,0));}
  return result;
 };
 prototype.removeEventListener=function(type,callback,...args){
  const result=Reflect.apply(remove,this,[type,callback,...args]);
  if(type==='statechange'){const listeners=contexts.get(this);listeners?.delete(callback);if(!listeners?.size)contexts.delete(this);}
  return result;
 };
 window.audioLifecycleMonitor={get live(){return [...contexts.values()].reduce((sum,set)=>sum+set.size,0);},get peak(){return peak;}};
 window.audioLifecycleNative={connect:AudioNode.prototype.connect,disconnect:AudioNode.prototype.disconnect,start:AudioBufferSourceNode.prototype.start,stop:AudioBufferSourceNode.prototype.stop};
})();
