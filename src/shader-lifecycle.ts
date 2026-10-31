import {createElement,Fragment,useLayoutEffect,type ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import type {PaperShaderElement} from '@paper-design/shaders';

function contexts(surface:HTMLElement){
  const result=new Set<WebGL2RenderingContext>();
  for(const canvas of surface.querySelectorAll('canvas'))try{const context=canvas.getContext('webgl2');if(context)result.add(context);}catch{/* another context must still be released */}
  return result;
}
function release(contexts:Iterable<WebGL2RenderingContext>){
  for(const context of contexts)try{if(!context.isContextLost())context.getExtension('WEBGL_lose_context')?.loseContext();}catch{/* optional GPU cleanup must not interrupt playback teardown */}
}
function ShaderContent({children,generation,onCommit}:{children:ReactNode;generation:number;onCommit:()=>void}){
  useLayoutEffect(onCommit,[generation,onCommit]);
  return createElement(Fragment,null,children);
}
/** Keep Paper's public React API and recreate its GPU resources after native restoration. */
export function createShaderRoot(surface:HTMLElement):Root{
  const root=createRoot(surface),lost=new Set<HTMLCanvasElement>(),retired=new Set<WebGL2RenderingContext>();
  const stopped=new WeakSet<object>();
  let latest:ReactNode=null,generation=0,disposed=false;
  const committed=()=>{release(retired);retired.clear();};
  const render=()=>root.render(createElement(ShaderContent,{key:generation,generation,onCommit:committed,children:latest}));
  const lostContext=(event:Event)=>{
    if(disposed||!(event.target instanceof HTMLCanvasElement)||!surface.contains(event.target))return;
    event.preventDefault();lost.add(event.target);
    // Pause every shader in a multi-canvas surface until the whole surface can
    // be rebuilt. Visibility changes cannot restart a mount whose speed is zero.
    for(const canvas of surface.querySelectorAll('canvas'))try{
      const mount=(canvas.parentElement as PaperShaderElement|null)?.paperShaderMount;
      if(!mount)continue;
      if(!stopped.has(mount)){
        const setSpeed=mount.setSpeed;
        // Paper's queued React effects can still deliver an older nonzero
        // speed. This owned instance will be disposed on recovery, so prevent
        // every later speed update from restarting its lost-context loop.
        mount.setSpeed=()=>setSpeed.call(mount,0);stopped.add(mount);
      }
      mount.setSpeed(0);
    }catch{/* continue stopping the other mounts */}
  };
  const restoredContext=(event:Event)=>{
    if(disposed||!(event.target instanceof HTMLCanvasElement)||!lost.delete(event.target)||lost.size)return;
    for(const context of contexts(surface))retired.add(context);
    generation++;render();
  };
  surface.addEventListener('webglcontextlost',lostContext,true);
  surface.addEventListener('webglcontextrestored',restoredContext,true);
  return {
    render(children){if(disposed)return;latest=children;if(!lost.size)render();},
    unmount(){
      if(disposed)return;disposed=true;latest=null;lost.clear();
      surface.removeEventListener('webglcontextlost',lostContext,true);surface.removeEventListener('webglcontextrestored',restoredContext,true);
      try{root.unmount();}finally{committed();}
    },
  };
}
/** Paper disposes GPU resources on unmount; also release the browser's context slot. */
export function unmountShader(root:Root|null,surface:HTMLElement){
  if(!root)return;
  const owned=contexts(surface);
  try{root.unmount();}catch{/* keep releasing optional visuals */}finally{release(owned);}
}
