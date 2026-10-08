async page => {
 const warnings=[];page.on('console',message=>{if(message.text().includes('Too many active WebGL contexts'))warnings.push(message.text());});
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>{localStorage.removeItem('soundsky:settings');});await page.reload();
 // Retain contexts deliberately: this verifies explicit release instead of relying on GC.
 await page.evaluate(()=>{window.ownedContexts=new Set();const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const context=original.call(this,type,...args);if(context&&type==='webgl2')window.ownedContexts.add(context);return context;};});
 await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
 await page.getByRole('button',{name:'見た目の設定',exact:true}).click();
 await page.getByRole('tab',{name:'SoundCloud',exact:true}).click();
 const toggle=page.getByRole('switch',{name:'SoundCloudの見た目を整える',exact:true});
 for(let i=0;i<8;i++){
   await toggle.check();await page.waitForTimeout(160);
   await toggle.uncheck();await page.waitForTimeout(100);
 }
 const result=await page.evaluate(()=>({created:window.ownedContexts.size,active:[...window.ownedContexts].filter(gl=>!gl.isContextLost()).length}));
 if(result.created<16||result.active>6||warnings.length)throw new Error(JSON.stringify({result,warnings}));
 await page.evaluate(()=>window.__soundsky.destroy());await page.waitForTimeout(100);
 const remaining=await page.evaluate(()=>[...window.ownedContexts].filter(gl=>!gl.isContextLost()).length);
 if(remaining)throw new Error('Destroy retains '+remaining+' owned contexts');
 return {...result,afterDestroy:remaining,noContextLimitWarning:true};
}
