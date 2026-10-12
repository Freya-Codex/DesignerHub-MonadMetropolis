const path=require('path');const sharp=require('sharp');
(async()=>{
 const qa=path.join(__dirname,'qa');
 const list=['slide-06','slide-12'];
 const tw=960,th=540,gap=12;
 const W=tw+2*gap,H=2*th+3*gap;
 const comps=[];
 for(let i=0;i<list.length;i++){
   const b=await sharp(path.join(qa,list[i]+'.png')).resize(tw,th).png().toBuffer();
   comps.push({input:b,left:gap,top:gap+i*(th+gap)});
 }
 await sharp({create:{width:W,height:H,channels:3,background:'#333'}}).composite(comps).png().toFile(path.join(qa,'sheet3.png'));
 console.log('ok');
})();
