const {chromium}=require('playwright');const path=require('path');
(async()=>{
 const b=await chromium.launch({channel:'chrome'});
 const p=await b.newPage({viewport:{width:960,height:540}});
 for(const s of ['slide-02','slide-04','slide-03']){
   await p.goto('file://'+path.join(__dirname,'slides',s+'.html'));
   const r=await p.evaluate(()=>{
     const g=(sel)=>{const e=document.querySelector(sel);if(!e)return null;const b=e.getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom),h:Math.round(b.height)};};
     const wrap=document.querySelector('.wrap').getBoundingClientRect();
     const grow=document.querySelector('.growrow');
     const kids=grow?[...grow.children].map(c=>{const b=c.getBoundingClientRect();return Math.round(b.top)+'-'+Math.round(b.bottom);}):[];
     return {bodyH:document.body.scrollHeight,wrap:[Math.round(wrap.top),Math.round(wrap.bottom)],grow:g('.growrow'),foot:g('.foot'),kids};
   });
   console.log(s,JSON.stringify(r));
 }
 await b.close();
})();
