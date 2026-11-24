const prefix='ajisai.2027.view.v1.';
const pages=['home','days','food','hotels','tickets','tasks','budget'];
const dayPattern=/^D[1-6]$/;
const detailPattern=/^(?:edit|info)-stop-\d{1,3}$/;
const distance=value=>Number.isFinite(value)?Math.max(0,Math.min(Math.round(value),100000)):0;
function safe(value={}){
  const positions={};
  for(const [key,position] of Object.entries(value.positions||{})){
    if(!position||!pages.includes(key)&&!/^days:D[1-6]$/.test(key))continue;
    positions[key]={top:distance(position.top),tabs:distance(position.tabs),
      details:Array.isArray(position.details)?position.details.filter(id=>detailPattern.test(id)).slice(0,120):[]};
  }
  return {page:pages.includes(value.page)?value.page:'home',day:dayPattern.test(value.day)?value.day:'D1',positions};
}
export function viewStore(uid){
  const key=prefix+encodeURIComponent(uid);
  return {
    read(fallback={}){
      try{
        const raw=localStorage.getItem(key);
        if(!raw)return fallback;
        const current=safe(JSON.parse(raw));
        const positions={...fallback.positions};
        for(const [id,value] of Object.entries(current.positions))positions[id]={...positions[id],...value};
        return {...current,positions};
      }catch{return fallback}
    },
    save(value){
      try{
        const next=JSON.stringify(safe(value));
        if(localStorage.getItem(key)!==next)localStorage.setItem(key,next);
        return true;
      }catch{return false}
    },
    clear(){try{localStorage.removeItem(key)}catch{}}
  };
}
