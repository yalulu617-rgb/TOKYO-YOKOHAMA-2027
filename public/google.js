import {apiKey,projectId,appId,authDomain} from './config.js';
let auth,sdk,appModule,loading,sharedMode=false;
const persistent=()=>[sdk.indexedDBLocalPersistence,sdk.browserLocalPersistence];
async function prepare(){
  if(!apiKey||!appId||!projectId)throw Error('尚未設定東京專用 Firebase 專案。');
  const [app,authModule]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js')]);
  appModule=app;
  sdk=authModule;
  auth??=sdk.initializeAuth(app.getApps()[0]||app.initializeApp({apiKey,projectId,appId,authDomain}),{persistence:[...persistent(),sdk.inMemoryPersistence]});
  await auth.authStateReady();
}
function warm(){
  return loading??=prepare().catch(e=>{loading=null;throw e});
}
const identify=user=>user&&({uid:user.uid,email:user.email,getToken:()=>user.getIdToken()});
export async function restoreLogin(){
  await warm();
  return identify(auth.currentUser);
}
export const watchLogin=listener=>sdk.onAuthStateChanged(auth,user=>listener(user?.uid||null));
export async function googleLogin(remember=true,chooseAccount=false){
  await warm();
  // initializeAuth selects the first storage adapter that the browser supports.
  // Explicitly opt out only for a shared device.
  if(!remember){
    await sdk.setPersistence(auth,sdk.inMemoryPersistence);
    sharedMode=true;
  }else if(sharedMode){
    // A previous shared-device attempt used this page's in-memory Auth instance.
    // Reinitialize that instance so the SDK can select available storage again.
    const app=auth.app;
    await sdk.signOut(auth);
    await appModule.deleteApp(app);
    auth=null;loading=null;sharedMode=false;
    await warm();
  }
  const provider=new sdk.GoogleAuthProvider();
  if(chooseAccount)provider.setCustomParameters({prompt:'select_account'});
  provider.setCustomParameters({prompt:'select_account'});
  let result;
  try{result=await sdk.signInWithPopup(auth,provider,sdk.browserPopupRedirectResolver)}catch(e){
    if(e.code==='auth/popup-blocked')throw Error('瀏覽器阻擋 Google 登入視窗。請允許這個網站的彈出式視窗，再按一次登入。');
    throw e;
  }
  return identify(result.user);
}
export async function logout(){
  await warm();
  await sdk.signOut(auth);
}

