import {useMemo,useState} from 'react';
import {Api,Money,Quantity} from '../Api.js';
import {Heading,Icon,Field,Modal,Notice,Empty,DemoBadge} from './Common.jsx';
function RelationForm({Data,Item,OnClose,OnSaved}) {
  const [SourceId,SetSource]=useState(Item?.SourceId||'');const [TargetId,SetTarget]=useState(Item?.TargetId||'');
  const [Error,SetError]=useState('');const [Busy,SetBusy]=useState(false);
  const Source=Data.Elements.find(E=>E.ElementId===SourceId);const Target=Data.Elements.find(E=>E.ElementId===TargetId);
  const Offer=Source?.ElementType==='Supplier'&&Target?.ElementType==='Material';
  const Requirement=Source?.ElementType==='Material'&&Target?.ElementType==='Product';
  async function Save(Event){Event.preventDefault();SetBusy(true);SetError('');const Form=new FormData(Event.currentTarget);
    const Body={SourceId,TargetId,Value:Offer||Requirement?Form.get('Value'):null,IsDemo:Form.get('IsDemo')==='on'};
    if(Item)Body.Version=Item.Version;
    try{await Api('/api/relations',{method:Item?'PATCH':'POST',body:Body});await OnSaved();OnClose();}catch(Failure){SetError(Failure.message);}finally{SetBusy(false);}
  }
  return <Modal Title={Item?'Editar relación':'Agregar relación'} OnClose={OnClose}><form onSubmit={Save}><Notice Text={Error} Error/><p>Conecta un requisito con el elemento que lo necesita.</p><div className="form-grid"><Field Label="Origen (requisito)"><select value={SourceId} onChange={E=>SetSource(E.target.value)} disabled={!!Item} required><option value="">Selecciona un elemento</option>{Data.Elements.map(E=><option key={E.ElementId} value={E.ElementId}>{E.Name}</option>)}</select></Field><Field Label="Destino (dependiente)"><select value={TargetId} onChange={E=>SetTarget(E.target.value)} disabled={!!Item} required><option value="">Selecciona un elemento</option>{Data.Elements.map(E=><option key={E.ElementId} value={E.ElementId}>{E.Name}</option>)}</select></Field></div>
    {Offer||Requirement?<><Field Label={Offer?'Precio por unidad (COP)':'Cantidad requerida'} Hint={Offer?'Por una unidad de '+(Target?.UnitCode||'compra'):'Unidades de '+(Source?.UnitCode||'insumo')+' por producto.'}><input key={Offer?'Offer':'Requirement'} type="number" name="Value" defaultValue={Item?.Value||''} min={Offer?'0':'0.0001'} step={Offer?'0.01':'0.0001'} required/></Field><label className="checkbox"><input type="checkbox" name="IsDemo" defaultChecked={Item?.IsDemo||false}/>Este valor es de demostración</label></>:<p className="info-panel">Esta conexión es una dependencia general y no lleva un peso.</p>}
    <div className="form-actions"><button type="button" onClick={OnClose} disabled={Busy}>Cancelar</button><button className="primary" disabled={Busy}>{Busy?'Guardando…':'Guardar relación'}</button></div></form></Modal>;
}
export default function Relations({Data,CanEdit,OnChange}){
  const [Tab,SetTab]=useState('Offer');const [Search,SetSearch]=useState('');const [Editing,SetEditing]=useState(null);
  const [Deleting,SetDeleting]=useState(null);const [Error,SetError]=useState('');const [Busy,SetBusy]=useState(false);
  const ElementLookup=useMemo(()=>new Map(Data.Elements.map(E=>[E.ElementId,E])),[Data.Elements]);
  const Tabs={Offer:'Precios de proveedores',Requirement:'Insumos por producto',General:'Dependencias generales'};
  const Items=Data.Relations.filter(E=>E.RelationType===Tab&&((ElementLookup.get(E.SourceId)?.Name||'')+' '+(ElementLookup.get(E.TargetId)?.Name||'')).toLowerCase().includes(Search.toLowerCase()));
  async function Remove(){SetBusy(true);try{await Api('/api/relations',{method:'DELETE',body:{SourceId:Deleting.SourceId,TargetId:Deleting.TargetId,Version:Deleting.Version}});SetDeleting(null);await OnChange();}catch(Failure){SetError(Failure.message);SetDeleting(null);}finally{SetBusy(false);}}
  return <><Heading Title="Relaciones" Description="Define quién suministra cada insumo y cuánto necesita cada producto." Children={CanEdit&&<button className="primary" onClick={()=>SetEditing({New:true})}><Icon Name="plus"/>Agregar relación</button>}/>
    <div className="subnav">{Object.entries(Tabs).map(([Key,Label])=><button key={Key} className={Tab===Key?'active':''} onClick={()=>SetTab(Key)}>{Label}<span>{Data.Relations.filter(E=>E.RelationType===Key).length}</span></button>)}</div><Notice Text={Error} Error/>
    <div className="context-note"><Icon Name="relations"/><p>{Tab==='Offer'?'Los proveedores son alternativas de compra. La estimación usa el menor precio disponible por insumo.':Tab==='Requirement'?'Las cantidades de todos los insumos de un producto se suman en su estimación de materiales.':'Estas relaciones conservan conexiones especiales, ciclos y autorrelaciones del catálogo original.'}</p></div>
    <section className="surface"><div className="table-toolbar"><h2>{Tabs[Tab]}</h2><label className="search"><Icon Name="search"/><input aria-label="Buscar relaciones" placeholder="Buscar una conexión" value={Search} onChange={E=>SetSearch(E.target.value)}/></label></div>{Items.length?<div className="table-scroll"><table><thead><tr><th>Origen</th><th>Destino</th><th>{Tab==='Offer'?'Precio / unidad':Tab==='Requirement'?'Cantidad / producto':'Tipo'}</th><th>Valor</th>{CanEdit&&<th>Acciones</th>}</tr></thead><tbody>{Items.map(E=><tr key={E.SourceId+'-'+E.TargetId}><td><strong>{ElementLookup.get(E.SourceId)?.Name}</strong></td><td>{ElementLookup.get(E.TargetId)?.Name}</td><td>{E.RelationType==='Offer'?Money(E.Value)+' / '+ElementLookup.get(E.TargetId)?.UnitCode:E.RelationType==='Requirement'?Quantity(E.Value)+' '+ElementLookup.get(E.SourceId)?.UnitCode:'Dependencia'}</td><td>{Tab==='General'?'Sin peso':<DemoBadge Value={E.IsDemo}/>}</td>{CanEdit&&<td><div className="row-actions"><button onClick={()=>SetEditing(E)}>Editar</button><button className="danger-text" onClick={()=>SetDeleting(E)}>Eliminar</button></div></td>}</tr>)}</tbody></table></div>:<Empty Text="No hay relaciones que coincidan con la búsqueda."/>}</section>
    {Editing&&<RelationForm Data={Data} Item={Editing.New?null:Editing} OnClose={()=>SetEditing(null)} OnSaved={OnChange}/>}
    {Deleting&&<Modal Title="Eliminar relación" OnClose={()=>!Busy&&SetDeleting(null)}><p>Se eliminará la conexión de <strong>{ElementLookup.get(Deleting.SourceId)?.Name}</strong> a <strong>{ElementLookup.get(Deleting.TargetId)?.Name}</strong>. Los elementos se conservarán.</p><div className="form-actions"><button disabled={Busy} onClick={()=>SetDeleting(null)}>Cancelar</button><button className="danger" disabled={Busy} onClick={Remove}>Confirmar eliminación</button></div></Modal>}
  </>;
}


