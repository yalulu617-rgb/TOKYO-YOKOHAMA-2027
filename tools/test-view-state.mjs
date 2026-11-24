import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../public/view-state.js',import.meta.url),'utf8');
const {viewStore}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const entries=new Map();
globalThis.localStorage={
  getItem:key=>entries.get(key)??null,
  setItem:(key,value)=>entries.set(key,value),
  removeItem:key=>entries.delete(key)
};
const one=viewStore('family-one'),two=viewStore('family-two');
assert.equal(one.save({
  page:'days',day:'D6',positions:{
    'days:D6':{top:584,tabs:260,details:['edit-stop-54','private text'],filter:'private search'}
  }
}),true);
const previous={page:'days',day:'D1',positions:{'days:D6':{top:0,filter:'encrypted search'}}};
assert.deepEqual(viewStore('family-one').read(previous),{
  page:'days',day:'D6',positions:{
    'days:D6':{top:584,tabs:260,details:['edit-stop-54'],filter:'encrypted search'}
  }
});
assert.equal(two.read(previous).day,'D1');
assert.ok([...entries.values()].every(value=>!value.includes('private')&&!value.includes('encrypted search')));
two.save({page:'unknown',day:'D99',positions:{evil:{top:12},'days:D2':{top:-10}}});
assert.deepEqual(two.read(),{page:'home',day:'D1',positions:{'days:D2':{top:0,tabs:0,details:[]}}});
one.clear();
assert.equal(one.read(previous),previous);
globalThis.localStorage.setItem=()=>{throw Error('blocked storage')};
assert.equal(one.save({page:'days',day:'D6'}),false);
console.log('View-state regression passed: synchronous resume, account isolation, field allowlist and storage failure.');
