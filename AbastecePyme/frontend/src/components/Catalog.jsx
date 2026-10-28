import { LatestRequest } from '../LatestRequest.js';
import { useState, useRef, useEffect } from 'react';
import { Api, TypeLabels, Money } from '../Api.js';
import { Heading, Icon, Field, Modal, Notice, Empty, DemoBadge } from './Common.jsx';

function ElementForm({ Item, Type, OnClose, OnSaved }) {
  const [Error, SetError] = useState(''); const [Busy, SetBusy] = useState(false);
  async function Submit(Event) {
    Event.preventDefault(); SetBusy(true); SetError('');
    const Form = new FormData(Event.currentTarget);
    const Body = {Name:Form.get('Name'),Description:Form.get('Description')};
    if(Type==='Material') Body.UnitCode=Form.get('UnitCode');
    if(Type==='Supplier') Body.Contact=Form.get('Contact');
    if(Item) Body.Version=Item.Version; else {Body.ElementId=Form.get('ElementId').toUpperCase();Body.ElementType=Type;}
    try {await Api(Item?'/api/elements/'+Item.ElementId:'/api/elements',{method:Item?'PATCH':'POST',body:Body}); await OnSaved();OnClose();}
    catch(Failure){SetError(Failure.message);} finally{SetBusy(false);}
  }
  return <Modal Title={(Item?'Editar ':'Agregar ')+TypeLabels[Type].toLowerCase()} OnClose={OnClose}><form onSubmit={Submit}><Notice Text={Error} Error/><div className="form-grid"><Field Label="Código" Hint="El código identifica al elemento y no se puede cambiar."><input name="ElementId" defaultValue={Item?.ElementId} disabled={!!Item} required pattern="[A-Za-z][A-Za-z0-9_-]{1,39}" maxLength={40} placeholder="Ej. INS-MADERA"/></Field><Field Label="Nombre"><input name="Name" defaultValue={Item?.Name} required minLength={2} maxLength={80} autoFocus/></Field></div>
    {Type==='Supplier' && <Field Label="Datos de contacto" Hint="Nombre de contacto, teléfono o correo (opcional)."><input name="Contact" defaultValue={Item?.Contact} maxLength={160}/></Field>}
    {Type==='Material' && <Field Label="Unidad de compra y uso" Hint="Usa la misma unidad para los precios y las cantidades de este insumo."><input name="UnitCode" defaultValue={Item?.UnitCode||'unidad'} required maxLength={30}/></Field>}
    <Field Label="Descripción (opcional)"><textarea name="Description" defaultValue={Item?.Description} rows={3} maxLength={1000}/></Field><div className="form-actions"><button type="button" onClick={OnClose} disabled={Busy}>Cancelar</button><button className="primary" disabled={Busy}>{Busy?'Guardando…':'Guardar cambios'}</button></div></form></Modal>;
}
export default function Catalog({Data,Type,CanEdit,OnChange}) {
  const EstimateRequest=useRef(null);if(!EstimateRequest.current)EstimateRequest.current=new LatestRequest();
  const [EstimateError,SetEstimateError]=useState('');
  useEffect(()=>()=>EstimateRequest.current.Cancel(),[]);
  function CloseDetail(){EstimateRequest.current.Cancel();SetDetail(null);}
  const [Search,SetSearch]=useState(''); const [Editing,SetEditing]=useState(null); const [Deleting,SetDeleting]=useState(null);
  const [Detail,SetDetail]=useState(null);const [Estimate,SetEstimate]=useState(null);const [Error,SetError]=useState('');const [Busy,SetBusy]=useState(false);
  const Items=Data.Elements.filter(Item=>Item.ElementType===Type && (Item.Name+' '+Item.ElementId).toLowerCase().includes(Search.toLowerCase()));
  async function Preview(Item){try{SetError('');SetDeleting(await Api('/api/elements/'+Item.ElementId+'/deletion-preview'));}catch(Failure){SetError(Failure.message);}}
  async function Remove(){SetBusy(true);try{await Api('/api/elements/'+Deleting.ElementId+'?Version='+Deleting.Version,{method:'DELETE'});SetDeleting(null);await OnChange();}catch(Failure){SetError(Failure.message);SetDeleting(null);}finally{SetBusy(false);}}
  function ShowDetail(Item){
    EstimateRequest.current.Cancel();SetDetail(Item);SetEstimate(null);SetEstimateError('');SetError('');
    if(Type==='Product')EstimateRequest.current.Run(
      ()=>Api('/api/products/'+Item.ElementId+'/estimate'),SetEstimate,Failure=>SetEstimateError(Failure.message));
  }
  const Plural={Supplier:'Proveedores',Material:'Insumos',Product:'Productos'};
  return <><Heading Title="Catálogo" Description="Cada elemento en su lugar, con la información que necesitas." Children={CanEdit?<button className="primary" onClick={()=>SetEditing({New:true})}><Icon Name="plus"/>Agregar {TypeLabels[Type].toLowerCase()}</button>:<span className="badge">Acceso de consulta</span>}/>
    <div className="subnav" aria-label="Tipos de elementos">{Object.keys(Plural).map(Key=><a className={Key===Type?'active':''} key={Key} href={'#catalog-'+Key}>{Plural[Key]}<span>{Data.Elements.filter(E=>E.ElementType===Key).length}</span></a>)}</div>
    <Notice Text={Error} Error/><section className="surface"><div className="table-toolbar"><h2>{Plural[Type]} <span className="count">{Items.length}</span></h2><label className="search"><Icon Name="search"/><input aria-label="Buscar en catálogo" placeholder="Buscar por nombre o código" value={Search} onChange={Event=>SetSearch(Event.target.value)}/></label></div>
    {Items.length?<div className="table-scroll"><table><thead><tr><th>Nombre</th><th>Código</th><th>{Type==='Material'?'Unidad':Type==='Supplier'?'Contacto':'Relaciones'}</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{Items.map(Item=><tr key={Item.ElementId}><td><button className="row-title" onClick={()=>ShowDetail(Item)}><span className={'type-symbol '+Type}><Icon Name={Type==='Supplier'?'users':'box'}/></span>{Item.Name}</button></td><td className="quiet">{Item.ElementId}</td><td>{Type==='Material'?Item.UnitCode:Type==='Supplier'?(Item.Contact||'Sin registrar'):Data.Relations.filter(E=>E.TargetId===Item.ElementId).length+' conexiones'}</td><td><div className="row-actions">{CanEdit?<><button onClick={()=>SetEditing(Item)} aria-label={'Editar '+Item.Name}>Editar</button><button className="danger-text" onClick={()=>Preview(Item)} aria-label={'Eliminar '+Item.Name}>Eliminar</button></>:<button onClick={()=>ShowDetail(Item)}>Ver detalles</button>}</div></td></tr>)}</tbody></table></div>:<Empty Text="No hay resultados. Prueba otra búsqueda o agrega un elemento."/>}
    <div className="table-footer">{Items.length} elementos visibles <span>Selecciona un nombre para ver sus detalles.</span></div></section>
    {Editing && <ElementForm Item={Editing.New?null:Editing} Type={Type} OnClose={()=>SetEditing(null)} OnSaved={OnChange}/>}
    {Deleting && <Modal Title="Eliminar elemento" OnClose={()=>!Busy&&SetDeleting(null)}><p>Se eliminará <strong>{Deleting.Name}</strong> y sus <strong>{Deleting.RelationshipCount} relaciones</strong>. Esta acción no se puede deshacer.</p><div className="form-actions"><button onClick={()=>SetDeleting(null)} disabled={Busy}>Cancelar</button><button className="danger" onClick={Remove} disabled={Busy}>{Busy?'Eliminando…':'Confirmar eliminación'}</button></div></Modal>}
    {Detail && <Modal Title={Detail.Name} OnClose={CloseDetail}><p className="quiet">{Detail.ElementId} · {TypeLabels[Type]}</p><p>{Detail.Description||'Este elemento no tiene descripción todavía.'}</p>{Detail.UnitCode&&<p>Unidad: {Detail.UnitCode}</p>}{Detail.Contact&&<p>Contacto: {Detail.Contact}</p>}
      {Type==='Product' && (Estimate?<div className="estimate"><h3>Estimación de materiales</h3><strong className="estimate-total">{Money(Estimate.Total)}</strong><div className="actions"><DemoBadge Value={Estimate.IsDemo}/><span className="badge">{Estimate.IsComplete?'Materiales con precio':'Estimación incompleta'}</span></div><p>Se usa el menor precio de proveedor para cada insumo.</p><ul>{Estimate.Choices.map(Choice=><li key={Choice.MaterialId}>{Data.Elements.find(E=>E.ElementId===Choice.MaterialId)?.Name||Choice.MaterialId}: {Choice.Quantity} × {Money(Choice.UnitPrice)} <small>Proveedor: {Data.Elements.find(E=>E.ElementId===Choice.SupplierId)?.Name||Choice.SupplierId}</small></li>)}</ul>{Estimate.Missing.length>0&&<p>Sin oferta: {Estimate.Missing.join(', ')}</p>}<p className="quiet">No incluye mano de obra, impuestos, transporte ni dependencias generales.</p></div>:EstimateError?<Notice Text={EstimateError} Error/>:<p role="status">Calculando…</p>)}
      <a className="button" href={'#graph?focus='+encodeURIComponent(Detail.ElementId)} onClick={CloseDetail}>Ver conexiones en el grafo</a></Modal>}
  </>;
}

