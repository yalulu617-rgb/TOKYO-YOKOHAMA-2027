import {googleLogin,restoreLogin,watchLogin,logout} from './google.js';
import {memberPanel,requestAccess} from './membership.js';
import * as cloud from './cloud.js';
import {openVault,forgetVault,hasVault,digest} from './vault.js';
import {rendererHash,layoutHash} from './integrity.js';
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
let tabRelease;
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
function change(id,value){
  if(!ready || locked || !window.validField(id,value))throw Error('無法寫入旅行欄位');
  const previous=session.pending[id];
  session.pending[id]={value,base:previous?previous.base:session.fields[id]?.revision||null};
  status('變更等待同步');store();schedule();
}
let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(sync,700)}
function showRemote(){
  if(!window.applyTravelFields)return;
  if(document.activeElement?.matches('input:not([type=checkbox]),textarea')){
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
  if(!navigator.onLine){status('離線中 · '+Object.keys(session.pending).length+' 項待同步');return}
  if(!onlineLogin){await reconnect();return}
  busy=true;status('同步中…');
  try{
    const rows=await cloud.changes(session.cursor);
    for(const row of rows){
      if(!window.validField(row.id,row.value))throw Error('雲端欄位異常，請核對備份。');
      session.fields[row.id]=row;session.cursor=row.time;
    }
    let redraw=rows.length>0;
    for(const [id,entry] of Object.entries({...session.pending})){
      if(session.pending[id]!==entry)continue;
      const remote=session.fields[id];
      if(remote && remote.revision!==entry.base){
        if(remote.value!==entry.value){
          if(!confirm('同一欄位有新版：'+id+'\n雲端：'+String(remote.value).slice(0,160)+'\n本機：'+String(entry.value).slice(0,160)+'\n確定保留本機值？按取消採用雲端值。')){
            delete session.pending[id];redraw=true;continue;
          }
          entry.base=remote.revision;
        }else{delete session.pending[id];continue}
      }
      const sent=structuredClone(entry);
      const revision=await cloud.put(id,sent);
      session.fields[id]={value:sent.value,revision,time:revision};
      if(session.pending[id]===entry)delete session.pending[id];
      else if(session.pending[id])session.pending[id].base=revision;
    }
    await store();
    if(redraw)showRemote();
    const pending=Object.keys(session.pending).length;
    const latest=Object.values(session.fields).map(x=>x.time).filter(Boolean).sort().pop();
    status(pending?'等待同步 '+pending+' 項':'已同步'+(latest?' · 最後修改 '+new Date(latest).toLocaleString('zh-TW',{timeZone:'Asia/Tokyo'})+' JST':''));
    if(pending)schedule();
  }catch(error){
    if(error.http===403||invalidLogin(error)){
      if(error.http===403)markDenied(session.uid,true);
      await endSession('旅行權限或登入已失效，請重新登入。');
      return;
    }
    status('尚未同步 · '+explain(error));
    if(error.http===409||error.status==='FAILED_PRECONDITION')schedule();
  }finally{busy=false}
}
async function mount(){
  const pkg=session.seed;
  if(await digest(pkg.renderer)!==rendererHash || await digest(pkg.layout)!==layoutHash)throw Error('旅行版本不相符，請連線更新網站。');
  $('original').innerHTML=pkg.layout;
  window.TRIP_DATA=structuredClone(pkg.data);
  window.travelBridge={snapshot,change,digest};
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
  await persist.catch(()=>{});
  if(clearVault)forgetVault();
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
async function openOnline(identity,apply=false){
  await lockTab();
  const seed=await authorizedPackage(identity,apply);
  session={uid:identity.uid,fields:{},pending:{},cursor:null,seed};
  onlineLogin=true;
  await mount();
  if(!ready)return;
  monitorLogin(identity.uid);
  await memberPanel(identity.uid).catch(error=>status('成員管理暫時無法載入 · '+explain(error)));
}
function gateError(error){
  $('gateStatus').textContent=explain(error);
  if(!ready&&!locked){$('original').replaceChildren();tabRelease?.();session=null;vault=null;onlineLogin=false}
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
      await mount();
    }else await openOnline(await googleLogin(form.remember.checked,chooseAccount),true);
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
$('retry').onclick=()=>reconnect(true);
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
      for(const [id,entry] of Object.entries(unlocked.value.pending)){
        if(session.pending[id] && session.pending[id].value!==entry.value &&
           !confirm('離線副本與目前頁面都有尚未同步的修改：'+id+'。確定保留離線副本的修改？'))continue;
        session.pending[id]=entry;
      }
      // Fetch from the start so recovered edits still use their original conflict bases.
      session.cursor=null;
    }
    vault=unlocked;
    await store();showRemote();
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
window.addEventListener('beforeunload',e=>{if(ready&&!vault&&Object.keys(session.pending).length){e.preventDefault();e.returnValue=''}});
window.addEventListener('online',()=>{if(ready)void reconnect();else if(!starting&&!locked)void resume()});
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

