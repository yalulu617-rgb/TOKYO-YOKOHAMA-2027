export const sameValue=(a,b)=>Object.is(a,b)||(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'&&JSON.stringify(a)===JSON.stringify(b));
export const isConflict=error=>error.http===409||['ABORTED','FAILED_PRECONDITION','ALREADY_EXISTS'].includes(error.status);
export function retryDelay(error,attempt){
  if(isConflict(error))return Math.min(500*2**attempt,10000);
  if(error.http===408||error.http===429||error.http>=500||
     ['TimeoutError','AbortError','TypeError'].includes(error.name))
    return Math.min(1000*2**attempt,60000)*(0.8+Math.random()*0.4);
  return null;
}
export function createOutbox({fields,pending,uid,checkpoint,put,choose,acked=new Set()}){
  function finish(id){
    delete pending[id];acked.add(id);checkpoint();
  }
  return {
    change(id,value){
      const previous=pending[id];
      if(previous&&sameValue(previous.value,value))return false;
      if(!previous&&fields[id]&&sameValue(fields[id].value,value))return false;
      pending[id]={value,base:previous?previous.base:fields[id]?.revision||null};
      if(previous?.attempt)pending[id].attempt=previous.attempt;
      return true;
    },
    async flush(){
      for(const id of Object.keys(pending)){
        const entry=pending[id],remote=fields[id];
        if(!entry)continue;
        if(remote&&remote.revision!==entry.base){
          if(sameValue(remote.value,entry.value)){
            finish(id);continue;
          }
          const ownAttempt=remote.author===uid&&entry.attempt&&sameValue(remote.value,entry.attempt.value);
          if(!ownAttempt&&!choose(id,remote.value,entry.value)){
            finish(id);continue;
          }
          entry.base=remote.revision;
        }
        entry.attempt={value:entry.value};
        // Record the attempted value before sending so a response lost after commit is recoverable.
        await checkpoint();
        if(pending[id]!==entry)continue;
        const revision=await put(id,entry);
        fields[id]={value:entry.value,revision,time:revision,author:uid};
        if(pending[id]===entry)finish(id);
        else if(pending[id]){pending[id].base=revision;checkpoint()}
      }
    }
  };
}
