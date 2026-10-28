export function BuildLayout(Elements, Relations, Focus, WholeGraph = false) {
  let Visible = Elements;
  if (Focus && !WholeGraph) {
    const Ids = new Set([Focus]);
    Relations.forEach(Edge => { if (Edge.SourceId===Focus) Ids.add(Edge.TargetId); if(Edge.TargetId===Focus) Ids.add(Edge.SourceId); });
    Relations.forEach(Edge => { if (Edge.RelationType==='Offer' && Ids.has(Edge.TargetId)) Ids.add(Edge.SourceId); });
    Visible = Elements.filter(Item=>Ids.has(Item.ElementId));
  }
  const Groups = ['Supplier','Material','Product'].map(Type=>Visible.filter(Item=>Item.ElementType===Type));
  const Rank = new Map();
  Groups.forEach(Group=>Group.forEach((Item,Index)=>Rank.set(Item.ElementId,Index)));
  for(let Pass=0;Pass<3;Pass++){
    Groups.forEach(Group=>{
      const Score=Item=>{
        const Neighbors=Relations.filter(Edge=>Edge.SourceId===Item.ElementId||Edge.TargetId===Item.ElementId)
          .map(Edge=>Rank.get(Edge.SourceId===Item.ElementId?Edge.TargetId:Edge.SourceId)).filter(Value=>Value!==undefined);
        return Neighbors.length?Neighbors.reduce((Sum,Value)=>Sum+Value,0)/Neighbors.length:Rank.get(Item.ElementId);
      };
      Group.sort((Left,Right)=>Score(Left)-Score(Right)||Left.Name.localeCompare(Right.Name));
      Group.forEach((Item,Index)=>Rank.set(Item.ElementId,Index));
    });
  }
  const Height=Math.max(500,Math.max(...Groups.map(Group=>Group.length))*76+110);
  const Nodes = Groups.flatMap((Group,Column)=>Group.map((Item,Index)=>({...Item,X:70+Column*340,Y:90+Index*76+(Height-110-Group.length*76)/2})));
  const NodeLookup = new Map(Nodes.map(Item=>[Item.ElementId,Item]));
  return {Nodes,Height,Edges:Relations.filter(Edge=>NodeLookup.has(Edge.SourceId)&&NodeLookup.has(Edge.TargetId)),Map:NodeLookup};
}
export function EdgePath(From,To) {
  if(From.ElementId===To.ElementId) return 'M '+(From.X+190)+' '+(From.Y+8)+' C '+(From.X+270)+' '+(From.Y-40)+', '+(From.X+270)+' '+(From.Y+80)+', '+(From.X+190)+' '+(From.Y+44);
  if(From.X===To.X) return 'M '+(From.X+206)+' '+(From.Y+26)+' C '+(From.X+290)+' '+(From.Y+26)+', '+(To.X+290)+' '+(To.Y+26)+', '+(To.X+206)+' '+(To.Y+26);
  const Forward=To.X>From.X;const Start=From.X+(Forward?206:0);const End=To.X+(Forward?0:206);const Mid=(Start+End)/2;
  return 'M '+Start+' '+(From.Y+26)+' C '+Mid+' '+(From.Y+26)+', '+Mid+' '+(To.Y+26)+', '+End+' '+(To.Y+26);
}


export function PanView(View, Fallback, DeltaX, DeltaY) {
  const Current=View||Fallback;
  return {...Current,X:Current.X-DeltaX,Y:Current.Y-DeltaY};
}

export function PathEdgeKeys(Path, Direction) {
  return new Set(Path.slice(1).map((Target,Index)=>
    Direction==='Requirements'?Target+'>'+Path[Index]:Path[Index]+'>'+Target));
}
