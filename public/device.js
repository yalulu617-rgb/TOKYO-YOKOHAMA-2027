const dbName='ajisai-2027-device';
const storeName='accounts';
const encode=new TextEncoder();
const envelope=(success,data,error=null)=>({success,data,error});

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(dbName,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(storeName);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('裝置儲存暫時被其他分頁鎖定。'));
  });
}
function record(db,mode,operation){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(storeName,mode);
    const request=operation(tx.objectStore(storeName));
    tx.oncomplete=()=>resolve(request.result);
    tx.onabort=()=>reject(tx.error||request.error||Error('裝置交易中斷。'));
  });
}
export async function openDevice(uid){
  let db;
  try{
    db=await openDb();
    const aad=encode.encode(dbName+':v1:'+uid);
    const existing=await record(db,'readonly',store=>store.get(uid));
    const key=existing?.key||await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const value=existing?.data?JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:existing.iv,additionalData:aad},key,existing.data
    ))):null;
    return envelope(true,{
      value,
      async save(payload){
        try{
          const iv=crypto.getRandomValues(new Uint8Array(12));
          const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,encode.encode(JSON.stringify(payload)));
          await record(db,'readwrite',store=>store.put({key,iv,data},uid));
          return envelope(true,null);
        }catch(error){return envelope(false,null,error.message)}
      },
      async clear(){await record(db,'readwrite',store=>store.delete(uid))},
      close(){db.close()}
    });
  }catch(error){
    db?.close();
    return envelope(false,null,error?.message||'無法讀取加密待同步資料。');
  }
}
