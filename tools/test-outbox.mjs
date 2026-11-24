import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const browserModule=async name=>import('data:text/javascript;base64,'+
  (await readFile(new URL('../public/'+name+'.js',import.meta.url))).toString('base64'));
const {createOutbox,retryDelay}=await browserModule('outbox');
const {expenseDraft}=await browserModule('expense');
const documents=new Map(),acknowledged=new Set(),snapshots=[];
const put=async(id,entry)=>{
  documents.set(id,structuredClone(entry.value));
  return String(documents.size);
};
const pending={};
const create=(uid,pending)=>createOutbox({
  uid,pending,fields:{},put,acked:acknowledged,choose:()=>true,
  checkpoint:async()=>snapshots.push(structuredClone(pending))
});
const first=create('A',pending),second=create('B',{});
const draft=expenseDraft({amountMinor:3800,currency:'JPY',payerId:'A',date:'2027-06-15',category:'交通'});
const another=expenseDraft({amountMinor:400,currency:'TWD',payerId:'B',date:'2027-06-15',category:'餐飲'});
assert.notEqual(draft.id,another.id);
assert.throws(()=>expenseDraft({...draft.value,date:'2027-02-30'}));
assert.equal(first.change(draft.id,draft.value),true);
assert.equal(first.change(draft.id,draft.value),false);
second.change(another.id,another.value);
await Promise.all([first.flush(),second.flush()]);
assert.equal(documents.size,2);
assert.equal(Object.keys(pending).length,0);
assert.ok(snapshots.some(snapshot=>snapshot[draft.id]?.attempt));
assert.ok(acknowledged.has(draft.id));
assert.ok(retryDelay({http:503},0)<retryDelay({http:503},3));
assert.equal(retryDelay({http:403},0),null);
console.log('Outbox and independent expense draft IDs passed.');
