import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Api,TypeLabels} from '../Api.js';
import {LatestRequest} from '../LatestRequest.js';
import {Empty,Field,Heading,Icon,Notice} from './Common.jsx';
const Graph=lazy(()=>import('./Graph.jsx'));

export default function Impact({Data}){
  const [ElementId,SetElementId]=useState('');
  const [Direction,SetDirection]=useState('Consequences');
  const [Search,SetSearch]=useState('');
  const [Result,SetResult]=useState(null);
  const [Selected,SetSelected]=useState('');
  const [Busy,SetBusy]=useState(false);
  const [Error,SetError]=useState('');
  const Gate=useRef(new LatestRequest());
  useEffect(()=>()=>Gate.current.Cancel(),[]);
  const Options=useMemo(()=>Data.Elements.filter(Element=>
    Element.ElementId===ElementId||(Element.Name+' '+Element.ElementId).toLocaleLowerCase().includes(Search.trim().toLocaleLowerCase())
  ),[Data,ElementId,Search]);
  const Lookup=useMemo(()=>new Map((Result?.Visited||[]).map(Row=>[Row.ElementId,Row])),[Result]);
  const Current=Lookup.get(Selected);
  const Path=Current?.Path||[];
  const Reverse=Result?.Direction==='Requirements';
  function Reset(){
    Gate.current.Cancel();SetResult(null);SetSelected('');SetError('');SetBusy(false);
  }
  async function Query(Event){
    Event.preventDefault();
    SetResult(null);SetSelected('');SetError('');SetBusy(true);
    await Gate.current.Run(
      ()=>Api('/api/impact/'+encodeURIComponent(ElementId)+'?Direction='+Direction),
      Value=>{SetResult(Value);SetSelected(Value.Reached[0]?.ElementId||Value.Origin.ElementId);SetBusy(false);},
      Failure=>{SetError((Failure.Status?Failure.Status+' · ':'')+Failure.message);SetBusy(false);}
    );
  }
  return <div className="impact-page">
    <Heading Title="Análisis de impacto" Description="Sigue las dependencias de tu red y entiende hasta dónde llega una conexión."/>
    <div className="impact-intro"><Icon Name="graph" Size={30}/><div><strong>Una pregunta, toda la cadena</strong><p>Consulta qué podría verse afectado si falta un proveedor o insumo, o descubre los requisitos de un producto.</p></div><span className="badge">Solo lectura</span></div>
    <form className="surface impact-query" onSubmit={Query}>
      <Field Label="¿Qué quieres conocer?"><select value={Direction} onChange={Event=>{Reset();SetDirection(Event.target.value);}}><option value="Consequences">Consecuencias: ¿qué podría afectar?</option><option value="Requirements">Requisitos: ¿de qué depende?</option></select></Field>
      <Field Label="Buscar en el catálogo"><input type="search" value={Search} onChange={Event=>SetSearch(Event.target.value)} placeholder="Nombre o código"/></Field>
      <Field Label="Elemento inicial"><select required value={ElementId} onChange={Event=>{Reset();SetElementId(Event.target.value);}}><option value="">Selecciona un elemento</option>{Options.map(Element=><option key={Element.ElementId} value={Element.ElementId}>{Element.Name} · {TypeLabels[Element.ElementType]} · {Element.ElementId}</option>)}</select></Field>
      <button className="primary" disabled={Busy||!ElementId}>{Busy?'Analizando…':'Analizar conexiones'}<Icon Name="arrow"/></button>
    </form>
    <Notice Text={Error} Error/>
    <div aria-live="polite">{Busy&&<p className="impact-loading">Recorriendo las relaciones del catálogo actual…</p>}</div>
    {!Result&&!Busy&&!Error&&<section className="surface"><Empty Text={Data.Elements.length?'Elige un elemento para consultar su alcance. Ningún registro se modificará.':'El catálogo está vacío. Agrega elementos y relaciones para comenzar.'}/></section>}
    {Result&&<>
      <section className="impact-result-heading" aria-live="polite"><span className="badge">{Reverse?'Requisitos directos e indirectos':'Impacto potencial'}</span><h2>{Result.Origin.Name}</h2><p>{Reverse?'Recorrido hacia los requisitos del elemento seleccionado.':'Recorrido hacia los elementos que dependen directa o indirectamente del origen.'}</p></section>
      <div className="impact-metrics">{[[Result.Summary.Total,Reverse?'Requisitos alcanzados':'Elementos potencialmente afectados'],[Result.Summary.Direct,'Directos'],[Result.Summary.Indirect,'Indirectos'],[Result.Summary.Products,'Productos alcanzados']].map(([Count,Label])=><div key={Label}><strong>{Count}</strong><span>{Label}</span></div>)}</div>
      <div className="impact-caution"><strong>{Reverse?'Dependencia registrada, no disponibilidad garantizada.':'Alcance potencial, no bloqueo confirmado.'}</strong><p>El análisis no conoce existencias ni capacidad de proveedores alternativos. El origen no se cuenta en los resultados. Precios y cantidades no determinan el alcance.</p></div>
      {Result.Status==='NoReachable'?<section className="surface"><Empty Text={Reverse?'El elemento existe, pero no tiene otros requisitos alcanzables en la red.':'El elemento existe, pero no tiene otros elementos dependientes alcanzables en la red.'}/><p className="impact-empty-note">Visitado: {Result.Origin.Name} ({Result.Origin.ElementId}), origen · profundidad 0.</p></section>:<>
        <section className="surface impact-traversal">
          <div className="table-toolbar"><div><h2>Recorrido explicado</h2><p className="quiet">Orden de visita por niveles. No representa un orden de producción.</p></div><span className="badge">{Result.Visited.length} visitados, incluido el origen</span></div>
          <div className="table-scroll"><table><caption className="sr-only">Elementos visitados en orden de recorrido</caption><thead><tr><th scope="col">Visita</th><th scope="col">Elemento</th><th scope="col">Tipo</th><th scope="col">Alcance</th><th scope="col">Camino</th></tr></thead><tbody>{Result.Visited.map((Row,Index)=><tr key={Row.ElementId} className={Selected===Row.ElementId?'impact-selected':''}><td>{Index+1}</td><td><strong>{Row.Name}</strong><small className="block quiet">{Row.ElementId}</small></td><td>{TypeLabels[Row.ElementType]}</td><td>{Row.Depth===0?'Origen':Row.Depth===1?'Directo':'Indirecto'}<small className="block quiet">{Row.Depth} {Row.Depth===1?'relación':'relaciones'} desde el origen</small></td><td><button aria-label={'Ver camino de '+Row.Name} aria-pressed={Selected===Row.ElementId} onClick={()=>SetSelected(Row.ElementId)}>Ver camino</button></td></tr>)}</tbody></table></div>
        </section>
        {Current&&<section className="surface impact-explanation" aria-live="polite"><h3>{Current.Depth===0?'Punto de partida':'Camino hasta '+Current.Name}</h3><p>{Reverse?'Se lee desde el origen hacia sus requisitos, en sentido inverso a las flechas del grafo.':'Se lee desde el origen hacia sus consecuencias, siguiendo las flechas del grafo.'}</p><ol className="impact-path-list">{Path.map((Key,Index)=><li key={Key}>{Index>0&&<span className="path-arrow" aria-hidden="true">{Reverse?'←':'→'}</span>}<span><strong>{Lookup.get(Key)?.Name||Key}</strong><small>{Key}</small></span></li>)}</ol><p className="quiet">Un camino de menor número de relaciones entre los posibles. No es una ruta de menor costo.</p></section>}
      </>}
      <section className="impact-graph"><h2>La cadena en el grafo</h2><p>Se muestran todos los elementos alcanzados y sus relaciones. El contorno discontinuo identifica el origen; el color ámbar destaca el camino elegido.</p><Suspense fallback={<p role="status">Preparando grafo…</p>}><Graph key={Result.Origin.ElementId+Result.Direction} Data={Result.Graph} InitialFocus={Result.Origin.ElementId} WholeGraph Embedded HighlightPath={Path} Direction={Result.Direction}/></Suspense></section>
    </>}
  </div>;
}

