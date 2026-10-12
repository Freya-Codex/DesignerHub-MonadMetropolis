const {chromium}=require('playwright');const path=require('path');
(async()=>{
 const b=await chromium.launch({channel:'chrome'});
 const p=await b.newPage({viewport:{width:960,height:540}});
 const all=[];for(let i=1;i<=13;i++)all.push('slide-'+String(i).padStart(2,'0'));
 for(const s of all){
   await p.goto('file://'+path.join(__dirname,'slides',s+'.html'));
   const r=await p.evaluate(()=>{
     const sc=document.body.scrollHeight;
     const ov=sc>541?'OVERFLOW':'';
     // find lowest content bottom excluding footer
     let maxb=0;document.querySelectorAll('.wrap > *:not(.foot) *').forEach(e=>{const b=e.getBoundingClientRect();if(b.height>0&&b.bottom>maxb)maxb=b.bottom;});
     const fe=document.querySelector(".foot");const foot=fe?fe.getBoundingClientRect():{top:540};
     return {sc,ov,gap:Math.round(foot.top-maxb)};
   });
   console.log(s,JSON.stringify(r));
 }
 await b.close();
})();
