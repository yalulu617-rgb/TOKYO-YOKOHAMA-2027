import {openDevice} from './device.js';
import {createOutbox,retryDelay} from './outbox.js';
import {googleLogin,restoreLogin,watchLogin,logout} from './google.js';
import {memberPanel,requestAccess} from './membership.js';
import * as cloud from './cloud.js';
import {openVault,forgetVault,hasVault,digest} from './vault.js';
import {rendererHash,layoutHash,offlineRenderers} from './integrity.js';
const $=id=>document.getElementById(id);
const status=text=>$('syncStatus').textContent=text;
let session,vault,onlineLogin=false,busy=false,persist=Promise.resolve(),ready=false,locked=false,starting=false,unwatch,chooseAccount=false;
const logoutKey='ajisai.2027.logout-pending';
function readFlag(key){try{return localStorage.getItem(key)}catch{return null}}
const deniedKey=uid=>'ajisai.2027.access-denied.'+uid;
function markDenied(uid,denied){
  try{if(denied)localStorage.setItem(deniedKey(uid),'1');else localStorage.removeItem(deniedKey(uid))}catch{}
}
function ensureAccess(uid){
  if(readFlag(deniedKey(uid)))throw Error('此帳號無法開啟離線副本，請連線重新驗證旅行權限。');
}
function invalidLogin(error){
  return error.http===401||['auth/user-token-expired','auth/user-disabled','auth/invalid-user-token','auth/user-not-found','auth/id-token-revoked'].includes(error.code);
}
let tabRelease,device,outbox,storageError='',savedGeneration=0,generation=0,retries=0,retryAt=0;
let deviceWrites=Promise.resolve(),lastServerCheck=false;
const count=()=>Object.keys(session?.pending||{}).length;
const saved=()=>savedGeneration===generation;
function pendingStatus(){
  if(!count())return;
  if(!saved()&&storageError){status('尚未安全儲存 · '+storageError+' 請保持頁面開啟至雲端確認。');return}
  if(!saved()){status('儲存中…');return}
  status(navigator.onLine?'已儲存在裝置，等待同步':'離線 · 已儲存在裝置，恢復連線後自動同步');
}
function mergePending(incoming){
  for(const [id,entry] of Object.entries(incoming||{})){
    const existing=session.pending[id];
    if(!existing||samePending(existing,entry))session.pending[id]=entry;
    else if(confirm('發現同欄位的兩份本機修改：'+id+'。確定採用較早的離線副本？'))session.pending[id]=entry;
  }
}
const samePending=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function setupOutbox(remember){
  if(remember){
    const result=await openDevice(session.uid);
    if(result.success){
      device=result.data;
      if(device.value?.ui)session.ui=device.value.ui;
      // A newer device journal takes precedence over the previous passphrase snapshot.
      if(device.value?.pending){
        for(const [id,entry] of Object.entries(device.value.pending))session.pending[id]=entry;
        for(const id of device.value.acked||[])if(!device.value.pending[id])delete session.pending[id];
      }
      session.acked=new Set(device.value?.acked||[]);
    }else storageError='無法開啟此帳號的加密裝置儲存。';
  }else storageError='共用裝置僅在目前頁面暫存。';
  session.acked??=new Set();
  outbox=createOutbox({
    ...session,put:cloud.put,checkpoint,choose:(id,remote,local)=>confirm(
      '同一欄位有新版：'+id+'\n雲端：'+String(remote).slice(0,160)+'\n本機：'+String(local).slice(0,160)+'\n確定保留本機值？按取消採用雲端值。')
  });
}
function lockTab(){
  return new Promise((resolve,reject)=>{
    if(!navigator.locks)return reject(Error('請使用支援安全分頁鎖定的新版瀏覽器。'));
    navigator.locks.request('ajisai-2027-writer',{ifAvailable:true},async lock=>{
      if(!lock){reject(Error('請先關閉另一個開啟手帳的分頁。'));return}
      resolve();await new Promise(r=>tabRelease=r);
    }).catch(reject);
  });
}
function snapshot(){return Object.fromEntries(Object.entries({...session.fields,...session.pending}).map(([id,x])=>[id,x.value]))}
function store(){
  if(!vault)return Promise.resolve();
  const copy=structuredClone(session);
  const write=persist.catch(()=>{}).then(()=>vault.save(copy));
  persist=write;
  write.catch(()=>status('本機加密儲存失敗，請立即匯出 JSON 備份。'));
  return write;
}
function checkpoint(){
  const version=++generation;
  const current=structuredClone({pending:session.pending,ui:session.ui||{},acked:[...session.acked]});
  const target=device,protect=vault;
  const write=deviceWrites.catch(()=>{}).then(async()=>{
    if(!target&&!protect)return;
    let ok=false;
    try{
      if(target){
        const result=await target.save(current);
        if(!result.success)storageError='裝置加密儲存失敗。';
        else ok=true;
      }
      if(protect)try{await store();ok=true}catch{if(!ok)storageError='離線副本無法安全儲存。'}
      if(ok){savedGeneration=version;storageError=''}
    }finally{if(!busy&&count())pendingStatus()}
  });
  deviceWrites=write;
  return write;
}
function change(id,value){
  if(!ready||locked||!window.validField(id,value))throw Error('無法寫入旅行欄位');
  if(!outbox.change(id,value))return;
  session.acked.delete(id);
  pendingStatus();void checkpoint();
  pendingStatus();
  schedule(350);
}
let timer,uiTimer;
function schedule(ms=0,override=false){
  if(!ready||locked||!navigator.onLine)return;
  clearTimeout(timer);
  timer=setTimeout(sync,Math.max(ms,override?0:retryAt-Date.now()));
}
function browse(value,immediate=false){
  session.ui=value;
  clearTimeout(uiTimer);
  if(immediate)void checkpoint();else uiTimer=setTimeout(checkpoint,160);
}
function showRemote(){
  if(!window.applyTravelFields)return;
  if(document.activeElement?.matches('input:not([type=checkbox]):not([type=search]),textarea')){
    document.activeElement.addEventListener('blur',()=>setTimeout(showRemote,0),{once:true});return;
  }
  window.applyTravelFields(snapshot());
}
function explain(error){
  if(error.http===429||error.status==='RESOURCE_EXHAUSTED')return '免費服務額度或速率受限，稍後再試。';
  if(error.http===403)return '此帳號沒有此旅行的存取權限。';
  if(error.http===401)return '登入已逾時，請重新登入。';
  if(/INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(error.message))return '帳號或密碼有誤。';
  return error.message;
}
async function sync(){
  if(!ready||locked||busy)return;
  if(!navigator.onLine){if(count())pendingStatus();else status('離線 · 恢復網路後自動同步');return}
  if(!onlineLogin){await reconnect();return}
  if(Date.now()<retryAt){schedule();return}
  busy=true;
  if(count()||!lastServerCheck)status('同步中…');
  let drainMore=false;
  const initialPending=new Set(Object.keys(session.pending));
  try{
    const rows=await cloud.changes(session.cursor);
    let changed=false;
    for(const row of rows){
      if(!window.validField(row.id,row.value))throw Error('雲端欄位異常，請核對備份。');
      if(session.fields[row.id]?.revision!==row.revision){
        session.fields[row.id]=row;changed=true;
      }
      session.cursor=row.time;
    }
    await outbox.flush();
    for(const id of initialPending)if(!session.pending[id])session.acked.add(id);
    if(initialPending.size)await checkpoint();
    else if(vault&&changed)await store();
    if(changed||initialPending.size)showRemote();
    retries=retryAt=0;lastServerCheck=true;drainMore=true;
    if(count())pendingStatus();
    else status('已同步至雲端');
  }catch(error){
    if(error.http===403||invalidLogin(error)){
      if(error.http===403)markDenied(session.uid,true);
      await endSession('旅行權限或登入已失效，請重新登入。');
      return;
    }
    const delay=retryDelay(error,retries);
    if(delay!==null){
      retries=Math.min(retries+1,8);retryAt=Date.now()+delay;
      status('同步暫時異常 · '+(count()?(saved()?'變更已加密保存，':'變更尚未安全儲存，'):'')+'將自動重試');
      schedule();
    }else status('同步異常 · '+explain(error)+(count()&&!saved()?' · 尚未安全儲存':'')+' · 可使用手動同步重試');
    showRemote();
  }finally{
    busy=false;
    // Edits can arrive after a flush captured its batch or while its last write is in flight.
    if(count()&&drainMore)schedule(100);
  }
}
async function mount(){
  const pkg=session.seed;
  const renderer=await digest(pkg.renderer);
  if((renderer!==rendererHash&&(onlineLogin||!offlineRenderers.includes(renderer)))||
     await digest(pkg.layout)!==layoutHash)throw Error('旅行版本不相符，請連線更新網站。');
  $('original').innerHTML=pkg.layout;
  window.TRIP_DATA=structuredClone(pkg.data);
  window.travelBridge={snapshot,change,digest,view:()=>session.ui||{},browse};
  const src=URL.createObjectURL(new Blob([pkg.renderer],{type:'text/javascript'}));
  try{await import(src)}finally{URL.revokeObjectURL(src)}
  await import('./art.js');
  $('gate').hidden=true;$('account').hidden=false;ready=true;
  await sync();
}
const form=$('signin');
$('offlineGate').hidden=!hasVault();
function gateBusy(value){
  starting=value;
  for(const button of form.querySelectorAll('button'))button.disabled=value;
}
async function endSession(message,clearVault=false,signOut=true){
  locked=true;ready=false;unwatch?.();clearTimeout(timer);
  $('original').replaceChildren();$('account').hidden=true;$('gate').hidden=false;
  window.TRIP_DATA=null;window.travelBridge=null;
  clearTimeout(uiTimer);
  await deviceWrites.catch(()=>{});await persist.catch(()=>{});
  if(clearVault){
    forgetVault();
    try{await device?.clear()}catch{}
  }
  device?.close();
  if(signOut){
    try{localStorage.setItem(logoutKey,'1')}catch{}
    try{
      await logout();
      try{localStorage.removeItem(logoutKey)}catch{}
    }catch(error){
      if(!readFlag(logoutKey)){
        $('gateStatus').textContent='無法清除登入狀態，請重新連線後再試。';
        return;
      }
      message='已關閉手帳。重新連網後會完成 Firebase 登出。';
    }
  }
  try{if(message)sessionStorage.setItem('ajisai.gate-message',message)}catch{}
  location.reload();
}
function monitorLogin(uid){
  unwatch?.();
  unwatch=watchLogin(next=>{
    if(ready&&!locked&&next!==uid)void endSession('登入帳號已變更，請重新驗證。',false,false);
  });
}
async function authorizedPackage(identity,apply=false){
  cloud.identify(identity);
  try{
    const pkg=await cloud.seed();
    markDenied(identity.uid,false);
    return pkg;
  }catch(error){
    if(error.http===403)markDenied(identity.uid,true);
    if(error.http===403||error.http===404){
      $('switchAccount').hidden=false;
      if(apply)throw Error(await requestAccess(identity));
      throw Error('這個 Google 帳號目前無法開啟旅行。若要申請，請按 Google 登入。');
    }
    throw error;
  }
}
async function openOnline(identity,apply=false,remember=true){
  await lockTab();
  const seed=await authorizedPackage(identity,apply);
  session={uid:identity.uid,fields:{},pending:{},cursor:null,seed};
  onlineLogin=true;
  $('vaultSettings').hidden=!remember;
  await setupOutbox(remember);
  await mount();
  if(!ready)return;
  monitorLogin(identity.uid);
  await memberPanel(identity.uid).catch(error=>status('成員管理暫時無法載入 · '+explain(error)));
}
function gateError(error){
  $('gateStatus').textContent=explain(error);
  if(!ready&&!locked){$('original').replaceChildren();tabRelease?.();device?.close();device=null;session=null;vault=null;onlineLogin=false}
}
form.addEventListener('submit',async e=>{
  e.preventDefault();if(starting||busy||ready||locked)return;
  const offline=e.submitter?.name==='offline';
  gateBusy(true);
  $('gateStatus').textContent='正在驗證…';
  try{
    if(offline){
      await lockTab();
      vault=await openVault('family-vault',form.password.value,false);session=vault.value;
      ensureAccess(session.uid);
      await setupOutbox(true);
      await mount();
    }else await openOnline(await googleLogin(form.remember.checked,chooseAccount),true,form.remember.checked);
  }catch(error){gateError(error)}
  finally{form.password.value='';gateBusy(false)}
});
$('switchAccount').onclick=async()=>{
  if(starting)return;
  gateBusy(true);
  try{await logout();chooseAccount=true;$('switchAccount').hidden=true;$('gateStatus').textContent='請使用另一個 Google 帳號登入。'}
  catch(error){gateError(error)}
  finally{gateBusy(false)}
};
async function reconnect(interactive=false){
  if(!ready||locked||busy)return;
  if(onlineLogin||!navigator.onLine){await sync();return}
  busy=true;
  status('正在恢復同步…');
  try{
    let identity=await restoreLogin();
    if(!identity&&interactive)identity=await googleLogin(true,true);
    if(!identity||identity.uid!==session.uid){status('請按同步並登入建立此副本的 Google 帳號。');return}
    session.seed=await authorizedPackage(identity);
    onlineLogin=true;monitorLogin(identity.uid);
    await memberPanel(identity.uid).catch(()=>{});
  }catch(error){
    if(readFlag(deniedKey(session.uid))||invalidLogin(error)){await endSession('旅行權限或登入已失效，請重新登入。');return}
    status('尚未同步 · '+explain(error));
  }finally{busy=false}
  if(onlineLogin)await sync();
}
$('retry').onclick=()=>{retryAt=0;void reconnect(true)};
$('vaultForm').onsubmit=async event=>{
  event.preventDefault();
  if(!ready||locked||busy||!onlineLogin||vault)return;
  const input=event.currentTarget.elements.password;
  busy=true;
  try{
    const unlocked=await openVault('family-vault',input.value,true);
    if(unlocked.value?.uid && unlocked.value.uid!==session.uid)throw Error('此離線副本屬於另一個帳號。');
    if(unlocked.value){
      for(const [id,entry] of Object.entries(unlocked.value.pending)){
        if(!window.validField(id,entry.value))throw Error('離線副本的欄位需要先核對。');
      }
      const pending=Object.fromEntries(Object.entries(unlocked.value.pending).filter(([id])=>!session.acked.has(id)));
      mergePending(pending);
      // Fetch from the start so recovered edits still use their original conflict bases.
      session.cursor=null;
    }
    vault=unlocked;
    await checkpoint();showRemote();
    $('vaultStatus').textContent='加密離線副本已解鎖。';
  }catch(error){$('vaultStatus').textContent=explain(error)}
  finally{input.value='';busy=false}
  await sync();
};
$('signout').onclick=async()=>{
  if(busy||locked){status('同步或登出處理中，請稍候。');return}
  if((Object.keys(session.pending).length||(!vault&&hasVault()))&&!confirm('本機可能有尚未同步的修改。登出將清除加密離線副本。若需先解鎖、同步或匯出備份，請按取消。'))return;
  await endSession('',true);
};
window.addEventListener('beforeunload',e=>{if(ready&&count()&&!saved()){e.preventDefault();e.returnValue=''}});
window.addEventListener('online',()=>{retryAt=0;if(ready)void reconnect();else if(!starting&&!locked)void resume()});
window.addEventListener('offline',sync);
setInterval(()=>{if(!document.hidden)sync()},90000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{$('gateStatus').textContent='此瀏覽器無法啟用離線模式。'});
async function resume(){
  gateBusy(true);
  try{
    let message;
    try{message=sessionStorage.getItem('ajisai.gate-message');sessionStorage.removeItem('ajisai.gate-message')}catch{}
    if(!navigator.onLine){$('gateStatus').textContent='目前離線，可解鎖已建立的加密副本。';return}
    if(readFlag(logoutKey)){await logout();localStorage.removeItem(logoutKey)}
    const identity=await restoreLogin();
    if(identity)await openOnline(identity);
    else{
      $('switchAccount').hidden=false;
      $('gateStatus').textContent=message||'';
    }
  }catch(error){gateError(error)}
  finally{gateBusy(false)}
}
void resume();

