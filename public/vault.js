const name = 'ajisai.2027.vault.v2';
const encode = new TextEncoder();
export const to64 = bytes => btoa(Array.from(new Uint8Array(bytes), b => String.fromCharCode(b)).join(''));
const from64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export async function digest(text) {
  const bytes = await crypto.subtle.digest('SHA-256', encode.encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
async function keyFor(password, salt) {
  const material = await crypto.subtle.importKey('raw', encode.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:600000, hash:'SHA-256'}, material, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
}
export async function openVault(email, password, create) {
  const existing = localStorage.getItem(name);
  const box = existing ? JSON.parse(existing) : null;
  const salt = box ? from64(box.salt) : crypto.getRandomValues(new Uint8Array(16));
  if (!box && !create) throw Error('這台裝置沒有離線副本。');
  const key = await keyFor(password,salt);
  let value;
  if (box) {
    try {
      const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(box.iv),additionalData:encode.encode(email)},key,from64(box.body));
      value = JSON.parse(new TextDecoder().decode(plain));
    } catch { throw Error('無法解鎖既有副本，請核對本機的裝置解鎖密語。'); }
  }
  return {value,async save(data) {
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encode.encode(email)},key,encode.encode(JSON.stringify(data)));
    localStorage.setItem(name,JSON.stringify({salt:to64(salt),iv:to64(iv),body:to64(encrypted)}));
  }};
}
export function hasVault(){
  try{return localStorage.getItem(name)!==null}catch{return false}
}
export function forgetVault(){
  if(hasVault())localStorage.removeItem(name);
}
