import test from 'node:test';
import assert from 'node:assert/strict';
import { BuildLayout, EdgePath } from '../frontend/src/components/GraphLayout.js';
test('layout preserves isolated nodes, directed cycles and self-links', () => {
  const Elements=[{ElementId:'S',Name:'Supplier',ElementType:'Supplier'},{ElementId:'M',Name:'Material',ElementType:'Material'},{ElementId:'P',Name:'Product',ElementType:'Product'}];
  const Relations=[{SourceId:'S',TargetId:'M',RelationType:'Offer'},{SourceId:'M',TargetId:'P',RelationType:'Requirement'},{SourceId:'P',TargetId:'P',RelationType:'General'}];
  const Layout=BuildLayout(Elements,Relations,'P');
  assert.equal(Layout.Nodes.length,3);
  assert.equal(Layout.Edges.length,3);
  assert.ok(Layout.Nodes.every(Node=>Number.isFinite(Node.X)&&Number.isFinite(Node.Y)));
  assert.match(EdgePath(Layout.Map.get('P'),Layout.Map.get('P')), /^M .+ C /);
  assert.equal(BuildLayout(Elements,[], '').Nodes.length,3);
});

import { PanView } from '../frontend/src/components/GraphLayout.js';
test('panning after resetting the view uses its fit bounds',()=>{
  assert.deepEqual(PanView(null,{X:0,Y:0,Width:1100,Height:500},20,-10),{X:-20,Y:10,Width:1100,Height:500});
});
test('impact graph keeps every reachable node even with an origin selected',()=>{
 const Elements=['S1','M1','P1','P2','P3'].map((ElementId,Index)=>({ElementId,Name:ElementId,ElementType:Index===0?'Supplier':Index===1?'Material':'Product'}));
 const Relations=[['S1','M1'],['M1','P1'],['P1','P2'],['P2','P3']].map(([SourceId,TargetId])=>({SourceId,TargetId,RelationType:'General'}));
 const Layout=BuildLayout(Elements,Relations,'S1',true);
 assert.equal(Layout.Nodes.length,5);
 assert.equal(Layout.Edges.length,4);
 assert.equal(BuildLayout(Elements,Relations,'S1').Nodes.length,2);
});
import { PathEdgeKeys } from '../frontend/src/components/GraphLayout.js';
test('reverse explanations highlight edges in their stored direction',()=>{
 assert.deepEqual([...PathEdgeKeys(['P2','P1','M1','S1'],'Requirements')],['P1>P2','M1>P1','S1>M1']);
 assert.deepEqual([...PathEdgeKeys(['S1','M1','P1'],'Consequences')],['S1>M1','M1>P1']);
 assert.equal(PathEdgeKeys([],'Consequences').size,0);
});
