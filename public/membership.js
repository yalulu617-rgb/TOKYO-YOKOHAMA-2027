import {family,requests,apply,approve} from './cloud.js';
export async function memberPanel(uid){
  const root=document.getElementById('familyPanel');
  const state=await family();
  if(state.admin!==uid)return;
  root.hidden=false;
  root.replaceChildren();
  const title=document.createElement('summary');title.textContent='家庭成員管理（'+state.uids.length+'/3）';root.append(title);
  const button=document.createElement('button');button.textContent='查看登入申請';root.append(button);
  button.onclick=async()=>{
    button.disabled=true;
    try{
      const list=await requests();
      root.querySelector('ul')?.remove();
      const ul=document.createElement('ul');root.append(ul);
      for(const req of list.filter(x=>!state.uids.includes(x.uid))){
        const li=document.createElement('li');li.textContent=req.email+' ';ul.append(li);
        const accept=document.createElement('button');accept.textContent='核准加入';accept.disabled=state.uids.length>=3;li.append(accept);
        accept.onclick=async()=>{
          if(!confirm('授權 '+req.email+' 查看與修改私人旅行資料？'))return;
          accept.disabled=true;
          try{await approve(state,req.uid);await memberPanel(uid)}catch(e){alert('核准失敗，請重新整理：'+e.message)}
        };
      }
      if(!ul.children.length)ul.textContent='目前沒有待核准的申請。';
    }catch(e){alert(e.message)}finally{button.disabled=false}
  };
}
export async function requestAccess(identity){
  await apply(identity);return '已提出加入申請。管理員核准後，請再以 Google 登入。';
}

