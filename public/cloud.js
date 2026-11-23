import {projectId,apiKey} from './config.js';
import {releaseId} from './integrity.js';
import {digest} from './vault.js';
let auth;
const root=()=> 'projects/'+projectId+'/databases/(default)/documents';
const api=()=> 'https://firestore.googleapis.com/v1/'+root();
async function request(url, options) {
  const res=await fetch(url,{...options,cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(18000)});
  const body=await res.json();
  if(!res.ok){const e=Error(body.error?.message||res.statusText);e.status=body.error?.status||res.status;e.http=res.status;throw e}
  return body;
}
export function identify(identity){auth=identity}
async function headers(){return {Authorization:'Bearer '+await auth.getToken(),'Content-Type':'application/json'}}
export async function seed(){
  const doc=await request(api()+'/release/'+releaseId,{headers:await headers()});
  const payload=doc.fields.payload.stringValue;
  if(await digest(payload)!==releaseId)throw Error('私人旅行資料校驗失敗，請聯絡管理員。');
  return JSON.parse(payload);
}
export async function changes(since){
  const structuredQuery={from:[{collectionId:'fields'}],orderBy:[{field:{fieldPath:'modified'},direction:'ASCENDING'}]};
  if(since)structuredQuery.where={fieldFilter:{field:{fieldPath:'modified'},op:'GREATER_THAN_OR_EQUAL',value:{timestampValue:since}}};
  const rows=await request(api()+':runQuery',{method:'POST',headers:await headers(),body:JSON.stringify({structuredQuery})});
  return rows.filter(r=>r.document).map(({document:d})=>({id:d.name.split('/').pop(),value:JSON.parse(d.fields.value.stringValue),revision:d.updateTime,time:d.fields.modified.timestampValue}));
}
export async function put(id,entry){
  const name=root()+'/fields/'+id;
  const write={update:{name,fields:{value:{stringValue:JSON.stringify(entry.value)},author:{stringValue:auth.uid}}},updateTransforms:[{fieldPath:'modified',setToServerValue:'REQUEST_TIME'}],currentDocument:entry.base?{updateTime:entry.base}:{exists:false}};
  const result=await request(api()+':commit',{method:'POST',headers:await headers(),body:JSON.stringify({writes:[write]})});
  return result.writeResults[0].updateTime;
}

export async function family(){
  const doc=await request(api()+'/access/family',{headers:await headers()});
  return {admin:doc.fields.admin.stringValue,uids:doc.fields.uids.arrayValue.values.map(v=>v.stringValue),revision:doc.updateTime};
}
export async function requests(){
  let token='',all=[];
  do{
    const page=await request(api()+'/requests?pageSize=100&pageToken='+encodeURIComponent(token),{headers:await headers()});
    all.push(...(page.documents||[]).map(d=>({uid:d.name.split('/').pop(),email:d.fields.email.stringValue})));
    token=page.nextPageToken;
  }while(token);
  return all;
}
export async function apply(identity){
  const path=api()+'/requests/'+encodeURIComponent(identity.uid);
  await request(path,{method:'PATCH',headers:await headers(),body:JSON.stringify({fields:{email:{stringValue:identity.email}}})});
}
export async function approve(state,uid){
  const values=[...state.uids,uid].map(stringValue=>({stringValue}));
  await request(api()+':commit',{method:'POST',headers:await headers(),body:JSON.stringify({writes:[{update:{name:root()+'/access/family',fields:{admin:{stringValue:state.admin},uids:{arrayValue:{values}}}},currentDocument:{updateTime:state.revision}}]})});
}
