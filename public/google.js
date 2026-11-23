import {apiKey,projectId,appId,authDomain} from './config.js';
let auth,sdk;
export async function googleLogin(){
  if(!apiKey||!appId||!projectId)throw Error('尚未設定東京專用 Firebase 專案。');
  const [app,authModule]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js')]);
  sdk=authModule;
  auth??=sdk.initializeAuth(app.getApps()[0]||app.initializeApp({apiKey,projectId,appId,authDomain}),{persistence:sdk.inMemoryPersistence,popupRedirectResolver:sdk.browserPopupRedirectResolver});
  const provider=new sdk.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  const result=await sdk.signInWithPopup(auth,provider);
  return {uid:result.user.uid,email:result.user.email,getToken:()=>result.user.getIdToken()};
}
export async function logout(){if(auth)await sdk.signOut(auth)}

