import {useEffect,useRef,useState} from 'react';
import {Api,TypeLabels} from '../Api.js';
import {LatestRequest} from '../LatestRequest.js';
import {Heading,Icon,Field,Notice} from './Common.jsx';
export default function ApiExplorer({Data}){
  const [Resource,SetResource]=useState('catalog');const [Product,SetProduct]=useState('');const [ElementId,SetElementId]=useState('');const [Direction,SetDirection]=useState('Consequences');
  const [Result,SetResult]=useState(null);const [Busy,SetBusy]=useState(false);const [Error,SetError]=useState('');
  const Gate=useRef(new LatestRequest());
  useEffect(()=>()=>Gate.current.Cancel(),[]);
  const Path=Resource==='estimate'?'/api/products/'+encodeURIComponent(Product)+'/estimate':Resource==='impact'?'/api/impact/'+encodeURIComponent(ElementId)+'?Direction='+Direction:'/api/'+Resource;
  function Reset(){Gate.current.Cancel();SetResult(null);SetError('');SetBusy(false);}
  async function Query(Event){
    Event.preventDefault();SetBusy(true);SetError('');SetResult(null);const Start=performance.now();
    await Gate.current.Run(()=>Api(Path),
      Response=>{SetResult({Data:Response,Duration:Math.round(performance.now()-Start),Path});SetBusy(false);},
      Failure=>{SetError((Failure.Status?Failure.Status+' · ':'')+Failure.message);SetBusy(false);});
  }
  return <><Heading Title="Explorador de API" Description="Consulta la información de tu red, sin escribir código."/><div className="api-layout"><form className="surface api-query" onSubmit={Query}><span className="badge">Solo lectura</span><h2>Prepara tu consulta</h2><Field Label="Información a consultar"><select value={Resource} onChange={Event=>{Reset();SetResource(Event.target.value);}}><option value="catalog">Catálogo y relaciones</option><option value="graph">Datos del grafo</option><option value="estimate">Estimación de un producto</option><option value="impact">Análisis de impacto</option></select></Field>
    {Resource==='estimate'&&<Field Label="Producto"><select required value={Product} onChange={Event=>{Reset();SetProduct(Event.target.value);}}><option value="">Selecciona un producto</option>{Data.Elements.filter(Element=>Element.ElementType==='Product').map(Element=><option key={Element.ElementId} value={Element.ElementId}>{Element.Name}</option>)}</select></Field>}
    {Resource==='impact'&&<><Field Label="Elemento inicial"><select required value={ElementId} onChange={Event=>{Reset();SetElementId(Event.target.value);}}><option value="">Selecciona un elemento</option>{Data.Elements.map(Element=><option key={Element.ElementId} value={Element.ElementId}>{Element.Name} · {TypeLabels[Element.ElementType]}</option>)}</select></Field><Field Label="Dirección de consulta"><select value={Direction} onChange={Event=>{Reset();SetDirection(Event.target.value);}}><option value="Consequences">Consecuencias potenciales</option><option value="Requirements">Requisitos</option></select></Field><p className="quiet">El alcance no confirma un bloqueo de producción. Las flechas almacenadas van del requisito al dependiente.</p></>}
    <div className="endpoint"><b>GET</b><code>{Path}</code></div><button className="primary" disabled={Busy}>{Busy?'Consultando…':'Consultar información'}<Icon Name="arrow"/></button><Notice Text={Error} Error/><p className="quiet">La consulta usa tu sesión y tus permisos. Los precios y cantidades se devuelven como cadenas decimales.</p></form><section className="surface api-result"><div className="table-toolbar"><h2>Respuesta</h2>{Result&&<div className="actions"><span className="badge success">200 Correcto</span><span className="quiet">{Result.Duration} ms</span></div>}</div>{Result?<><p className="result-path">{Result.Path}</p><pre tabIndex={0} aria-label="Resultado de la consulta">{JSON.stringify(Result.Data,null,2)}</pre></>:<div className="api-empty"><Icon Name="api" Size={48}/><h3>La información empieza con una consulta</h3><p>Elige un recurso y pulsa Consultar información.</p></div>}</section></div></>;
}

