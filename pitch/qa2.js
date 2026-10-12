const path=require('path');const sharp=require('sharp');
(async()=>{
 const qa=path.join(__dirname,'qa');
 const list=['slide-02','slide-07','slide-09','slide-13'];
 const tw=720,th=405,gap=14,cols=2;
 const rows=Math.ceil(list.length/cols);
 const W=cols*tw+(cols+1)*gap,H=rows*th+(rows+1)*gap;
 const comps=[];
 for(let i=0;i<list.length;i++){
   const b=await sharp(path.join(qa,list[i]+'.png')).resize(tw,th).png().toBuffer();
   comps.push({input:b,left:gap+(i%cols)*(tw+gap),top:gap+Math.floor(i/cols)*(th+gap)});
 }
 await sharp({create:{width:W,height:H,channels:3,background:'#c8c8cc'}}).composite(comps).png().toFile(path.join(qa,'sheet2.png'));
 console.log('ok');
})();
