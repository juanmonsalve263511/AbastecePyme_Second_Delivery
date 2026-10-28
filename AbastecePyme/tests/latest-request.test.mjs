import test from 'node:test';
import assert from 'node:assert/strict';
import { LatestRequest } from '../frontend/src/LatestRequest.js';
test('late product response cannot replace the latest product estimate',async()=>{
 const Gate=new LatestRequest();let ResolveA,ResolveB;const Results=[];
 const A=Gate.Run(()=>new Promise(Resolve=>{ResolveA=Resolve;}),Value=>Results.push(Value),()=>{});
 Gate.Cancel();
 const B=Gate.Run(()=>new Promise(Resolve=>{ResolveB=Resolve;}),Value=>Results.push(Value),()=>{});
 ResolveB('estimate B');await B;ResolveA('estimate A');await A;
 assert.deepEqual(Results,['estimate B']);
});
test('closing a modal ignores late errors, active errors are displayed',async()=>{
 const Gate=new LatestRequest();let Reject;const Errors=[];
 const A=Gate.Run(()=>new Promise((Resolve,Fail)=>{Reject=Fail;}),()=>{},Error=>Errors.push(Error.message));
 Gate.Cancel();Reject(new Error('old'));await A;
 assert.deepEqual(Errors,[]);
 await Gate.Run(()=>Promise.reject(new Error('unavailable')),()=>{},Error=>Errors.push(Error.message));
 assert.deepEqual(Errors,['unavailable']);
});
