/** Release observed nodes on source end/context close, even while animation is stopped. */
export class AudioLifetime<T extends AudioNode> {
  private contexts=new Map<BaseAudioContext,{nodes:Set<T>;changed:()=>void}>();
  private ended=new WeakMap<T,()=>void>();
  constructor(private released:(node:T)=>void) {}
  watch(node:T, source=false) {
    let entry=this.contexts.get(node.context);
    if(!entry){
      const context=node.context;
      const changed=()=>{if(context.state==='closed')for(const current of [...(this.contexts.get(context)?.nodes??[])])this.release(current);};
      entry={nodes:new Set(),changed};this.contexts.set(context,entry);
      try{context.addEventListener('statechange',changed);}catch{/* observation must not change native audio behavior */}
    }
    if(entry.nodes.has(node))return;
    entry.nodes.add(node);
    if(source){
      const ended=()=>this.release(node);this.ended.set(node,ended);
      try{node.addEventListener('ended',ended,{once:true});}catch{/* preserve native source behavior */}
    }
    if(node.context.state==='closed')this.release(node);
  }
  unwatch(node:T) {
    const ended=this.ended.get(node);
    if(ended){try{node.removeEventListener('ended',ended);}catch{/* invalidated source */}this.ended.delete(node);}
    const context=node.context,entry=this.contexts.get(context);
    entry?.nodes.delete(node);
    if(entry&&!entry.nodes.size){
      try{context.removeEventListener('statechange',entry.changed);}catch{/* invalidated context */}
      this.contexts.delete(context);
    }
  }
  private release(node:T){this.unwatch(node);this.released(node);}
  clear(){for(const entry of [...this.contexts.values()])for(const node of [...entry.nodes])this.unwatch(node);}
}
