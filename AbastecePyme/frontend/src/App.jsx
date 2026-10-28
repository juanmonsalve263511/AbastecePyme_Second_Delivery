import {lazy,Suspense,useCallback,useEffect,useState} from 'react';
import {Api,SetSession,RoleLabels} from './Api.js';
import {Brand,Icon,Notice} from './components/Common.jsx';
import Home from './components/Home.jsx';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import Catalog from './components/Catalog.jsx';
import Relations from './components/Relations.jsx';
const Impact=lazy(()=>import('./components/Impact.jsx'));
const Graph=lazy(()=>import('./components/Graph.jsx'));
const ApiExplorer=lazy(()=>import('./components/ApiExplorer.jsx'));
const Users=lazy(()=>import('./components/Users.jsx'));
const Account=lazy(()=>import('./components/Account.jsx'));
const EmptyData={Elements:[],Relations:[]};
const Navigation=[['dashboard','Resumen','dashboard'],['catalog-Supplier','Catálogo','catalog'],['relations','Relaciones','relations'],['graph','Grafo de abastecimiento','graph'],['impact','Análisis de impacto','search'],['api','Explorador de API','api']];
export default function App(){
  const [Route,SetRoute]=useState(()=>window.location.hash.slice(1)||'home');
  const [Session,UpdateSession]=useState(null);const [Ready,SetReady]=useState(false);const [Data,SetData]=useState(EmptyData);const [Loaded,SetLoaded]=useState(false);const [Error,SetError]=useState('');const [Menu,SetMenu]=useState(false);
  const ChangeSession=useCallback(Value=>{SetSession(Value);UpdateSession(Value);if(!Value){SetData(EmptyData);SetLoaded(false);}},[]);
  const Load=useCallback(async()=>{try{const Value=await Api('/api/catalog');SetData(Value);SetLoaded(true);SetError('');}catch(Failure){SetError(Failure.message);}},[]);
  useEffect(()=>{let Active=true;Api('/api/auth/session').then(Value=>{if(Active)ChangeSession(Value);}).catch(Failure=>{if(Failure.Status!==401&&Active)SetError(Failure.message);}).finally(()=>{if(Active)SetReady(true);});return()=>{Active=false;};},[ChangeSession]);
  useEffect(()=>{if(Session)Load();},[Session?.UserId,Load]);
  useEffect(()=>{function Navigate(){SetRoute(window.location.hash.slice(1)||'home');SetMenu(false);SetError('');}function Expired(){ChangeSession(null);window.location.hash='login';}window.addEventListener('hashchange',Navigate);window.addEventListener('session-expired',Expired);return()=>{window.removeEventListener('hashchange',Navigate);window.removeEventListener('session-expired',Expired);};},[ChangeSession]);
  async function Logout(){try{await Api('/api/auth/logout',{method:'POST'});ChangeSession(null);window.location.hash='home';}catch(Failure){SetError(Failure.message);}}
  if(!Ready)return <main className="loading" role="status">Preparando tu espacio…</main>;
  if(Route==='home'||Route==='services')return <Home Session={Session}/>;
  if(Route==='login'||Route==='register'||!Session)return <Login key={Route} Register={Route==='register'} OnSession={ChangeSession}/>;
  const Page=Route.split('?')[0];const Focus=new URLSearchParams(Route.split('?')[1]||'').get('focus')||'';
  const CanEdit=Session.RoleName!=='Viewer';
  return <div className="app-layout"><a className="skip-link" href="#main" onClick={E=>{E.preventDefault();document.getElementById('main').focus();}}>Saltar al contenido</a><aside className={'sidebar'+(Menu?' open':'')}><Brand/><p className="nav-caption">Espacio de trabajo</p><nav aria-label="Navegación principal">{Navigation.map(([Key,Label,Name])=><a key={Key} href={'#'+Key} className={(Page===Key||(Key.startsWith('catalog')&&Page.startsWith('catalog')))?'active':''} aria-current={(Page===Key||(Key.startsWith('catalog')&&Page.startsWith('catalog')))?'page':undefined}><Icon Name={Name}/>{Label}</a>)}{Session.RoleName==='Administrator'&&<a href="#users" className={Page==='users'?'active':''}><Icon Name="users"/>Usuarios y perfiles</a>}</nav><div className="sidebar-bottom"><a href="#home"><Icon Name="home"/>Página de inicio</a><div className="sidebar-note"><Icon Name="graph"/><p>Una red organizada.<br/>Decisiones más claras.</p></div></div></aside><div className="workspace"><header className="workspace-top"><button className="menu-toggle" aria-label="Abrir navegación" aria-expanded={Menu} onClick={()=>SetMenu(!Menu)}>☰</button><p>Mi empresa <span>/</span> AbastecePyme</p><div className="user-tools"><a className="user-profile" href="#account"><span className="avatar">{Session.DisplayName.slice(0,1).toUpperCase()}</span><span>{Session.DisplayName}<small>{RoleLabels[Session.RoleName]}</small></span></a><button className="icon-button" onClick={Logout} aria-label="Cerrar sesión"><Icon Name="logout"/></button></div></header><main id="main" className="workspace-main" tabIndex={-1}><Notice Text={Error} Error/>{!Loaded?<div className="loading"><p>{Error?'No se pudo cargar el catálogo.':'Cargando catálogo…'}</p>{Error&&<button onClick={Load}>Reintentar</button>}</div>:<Suspense fallback={<p role="status">Cargando sección…</p>}>
      {Page.startsWith('catalog-')?<Catalog key={Page} Data={Data} Type={['Supplier','Material','Product'].includes(Page.slice(8))?Page.slice(8):'Supplier'} CanEdit={CanEdit} OnChange={Load}/>:Page==='relations'?<Relations Data={Data} CanEdit={CanEdit} OnChange={Load}/>:Page==='graph'?<Graph key={Focus} Data={Data} InitialFocus={Focus}/>:Page==='impact'?<Impact Data={Data}/>:Page==='api'?<ApiExplorer Data={Data}/>:Page==='users'&&Session.RoleName==='Administrator'?<Users Session={Session} OnSession={ChangeSession}/>:Page==='account'?<Account Session={Session} OnSession={ChangeSession}/>:<Dashboard Data={Data} Session={Session}/>}
    </Suspense>}</main><footer className="workspace-footer">AbastecePyme <span>Tu red de abastecimiento, conectada.</span></footer></div></div>;
}

