import {apiKey,projectId,appId,authDomain} from './config.js';
let auth,sdk,loading;
async function prepare(){
  if(!apiKey||!appId||!projectId)throw Error('尚未設定東京專用 Firebase 專案。');
  const [app,authModule]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js')]);
  sdk=authModule;
  auth??=sdk.initializeAuth(app.getApps()[0]||app.initializeApp({apiKey,projectId,appId,authDomain}),{persistence:sdk.inMemoryPersistence,popupRedirectResolver:sdk.browserPopupRedirectResolver});
}
function warm(){
  return loading??=prepare().catch(e=>{loading=null;throw e});
}
if(apiKey&&navigator.onLine)warm().catch(()=>{});
export async function googleLogin(){
  if(!auth)await warm();
  const provider=new sdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  let result;
  try{result=await sdk.signInWithPopup(auth,provider)}catch(e){
    if(e.code==='auth/popup-blocked')throw Error('瀏覽器阻擋 Google 登入視窗。請允許這個網站的彈出式視窗，再按一次登入。');
    throw e;
  }
  return {uid:result.user.uid,email:result.user.email,getToken:()=>result.user.getIdToken()};
}
export async function logout(){if(auth)await sdk.signOut(auth)}

