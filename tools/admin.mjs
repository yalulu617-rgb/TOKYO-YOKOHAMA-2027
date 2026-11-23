// Run only with an authenticated project administrator's Google OAuth access token.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [project,mode='initialize']=process.argv.slice(2);
if(!/^tokyo-yokohama-2027[a-z0-9-]*$/.test(project||'')||project.length>30)throw Error('Dedicated project ID required');
const token=process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
if(!token)throw Error('A project administrator OAuth session is required.');
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function call(url,body){
 const r=await fetch(url,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error('Administrative request HTTP '+r.status+' at '+new URL(url).pathname);
 return r.json();
}
const billing=await call('https://cloudbilling.googleapis.com/v1/projects/'+project+'/billingInfo');
if(billing.billingEnabled!==false)throw Error('Billing must be confirmed disabled');
const self=await call('https://www.googleapis.com/oauth2/v3/userinfo');
if(!self.email_verified || !self.email)throw Error('Verified administrator Google identity required');
const base='projects/'+project+'/databases/(default)/documents/';
const api='https://firestore.googleapis.com/v1/'+base;
const release=JSON.parse(await readFile(new URL('../private/release.json',import.meta.url)));
const path='release/'+createHash('sha256').update(release.fields.payload.stringValue).digest('hex');
if(mode==='update-release'){
 await call(api.slice(0,-1)+':commit',{writes:[{update:{name:base+path,fields:release.fields},currentDocument:{exists:false}}]});
}else if(mode==='initialize'){
 const found=await call('https://identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:lookup',{email:[self.email]});
 const user=found.users?.find(u=>u.emailVerified && u.providerUserInfo?.some(p=>p.providerId==='google.com'&&p.rawId===self.sub));
 if(!user)throw Error('First sign in to the travel app with the project administrator Google account.');
 const uid=user.localId;
 const docs=[[path,release.fields],['access/family',{admin:{stringValue:uid},uids:{arrayValue:{values:[{stringValue:uid}]}}}]];
 await call(api.slice(0,-1)+':commit',{writes:docs.map(([path,fields])=>({update:{name:base+path,fields},currentDocument:{exists:false}}))});
}else throw Error('Invalid mode');
console.log('Private release operation completed.');

