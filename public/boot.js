import {googleLogin,logout} from './google.js';
import {memberPanel,requestAccess} from './membership.js';
import * as cloud from './cloud.js';
import {openVault,forgetVault,hasVault,digest} from './vault.js';
import {rendererHash,layoutHash} from './integrity.js';
const $=id=>document.getElementById(id);
const status=text=>$('syncStatus').textContent=text;
let session,vault,onlineLogin=false,busy=false,persist=Promise.resolve(),ready=false,locked=false;
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
  if(!onlineLogin||!navigator.onLine){status('離線中 · '+Object.keys(session.pending).length+' 項待同步'+(!onlineLogin?' · 連網後請重新登入':''));return}
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
    if(error.http===403){locked=true;ready=false;document.body.replaceChildren(document.createTextNode('旅行存取權限已撤銷，請重新登入。'));await persist.catch(()=>{});forgetVault();location.reload();return}
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
$('signin').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||ready)return;
  const form=e.currentTarget;
  const password=form.password.value;
  const offline=e.submitter?.name==='offline';
  const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  $('gateStatus').textContent='正在驗證…';
  try{
    if(!offline){
      if(form.trust.checked&&password.length<10)throw Error('請先設定至少 10 字元的裝置解鎖密語。');
      const identity=await googleLogin();cloud.identify(identity);
      await lockTab();
      const uid=identity.uid;
      let pkg;
      try{pkg=await cloud.seed()}catch(e){if(e.http===403||e.http===404)throw Error(await requestAccess(identity));throw e}
      vault=form.trust.checked?await openVault('family-vault',password,true):null;
      session=vault?.value||{uid,fields:{},pending:{},cursor:null};
      if(session.uid!==uid)throw Error('帳號與離線副本不符。');
      session.seed=pkg;onlineLogin=true;
    }else{
      await lockTab();
      vault=await openVault('family-vault',password,false);session=vault.value;onlineLogin=false;
    }
    form.password.value='';await mount();await store();if(onlineLogin)await memberPanel(session.uid);
  }catch(err){$('gateStatus').textContent=explain(err);if(!ready){$('original').replaceChildren();tabRelease?.();session=null;vault=null}}
  finally{buttons.forEach(b=>b.disabled=false)}
});
$('retry').onclick=async()=>{
  if(!onlineLogin && navigator.onLine){await store();location.reload();return}
  sync();
};
if(hasVault())$('signin').elements.trust.checked=true;
$('signout').onclick=async()=>{
  if(busy){status('同步作業處理中，請稍後登出。');return}
  if(Object.keys(session.pending).length&&!confirm('仍有未同步變更。登出會清除本機副本。若需先匯出備份，請按取消。'))return;
  locked=true;ready=false;await persist.catch(()=>{});if(vault)forgetVault();await logout();location.reload();
};
window.addEventListener('beforeunload',e=>{if(ready&&!vault&&Object.keys(session.pending).length){e.preventDefault();e.returnValue=''}});
window.addEventListener('online',sync);window.addEventListener('offline',sync);
setInterval(()=>{if(!document.hidden)sync()},90000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{$('gateStatus').textContent='此瀏覽器無法啟用離線模式。'});

