/* Imported files are uploaded to the signed-in server; local drafts never upload. */
(function(){'use strict';
const uploaded=new WeakMap();
async function upload(file,kind,signal){if(signal?.aborted)throw Error('Upload cancelled.');if(!file?.size)return null;if(uploaded.has(file))return uploaded.get(file);let blob=file,mime;
 if(kind==='photo'){if(file.size>20*1024*1024)throw Error('Choose a photo under 20 MB.');let image;try{image=await createImageBitmap(file)}catch{throw Error('This photo could not be opened. Try JPEG, PNG or WebP.')}try{const scale=Math.min(1,1600/Math.max(image.width,image.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));c.getContext('2d').drawImage(image,0,0,c.width,c.height);blob=await new Promise(r=>c.toBlob(r,'image/png'));mime='image/png'}finally{image.close()}if(!blob||blob.size>4*1024*1024)throw Error('This photo is too detailed to upload. Try a smaller image.');
 }else{if(file.size>12*1024*1024)throw Error('Choose an MP3 or WAV under 12 MB.');mime=/\.mp3$/i.test(file.name)?'audio/mpeg':/\.wav$/i.test(file.name)?'audio/wav':null;if(!mime)throw Error('Choose an MP3 or WAV file.');}
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('The file could not be read.'));reader.readAsDataURL(blob)});
 if(signal?.aborted)throw Error('Upload cancelled.');const res=await fetch('/api/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mime,name:file.name,data}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)}),result=await res.json();if(!res.ok)throw Error(result.error||'Upload failed. Please try again.');uploaded.set(file,result.id);return result.id;
}
window.FCMediaUpload={upload};
})();
