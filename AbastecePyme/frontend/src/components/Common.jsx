import { useEffect, useId, useRef } from 'react';
export function Icon({ Name, Size = 22 }) {
  const Paths = {
    home: 'M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10',
    dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    catalog: 'M4 4h16v16H4zM4 9h16M9 9v11',
    relations: 'M8 7h8M8 17h8M5 10v4M19 10v4M2 4h6v6H2zM16 4h6v6h-6zM2 14h6v6H2zM16 14h6v6h-6z',
    graph: 'M6 6l12 6-12 6M6 6v12M3 3h6v6H3zM15 9h6v6h-6zM3 15h6v6H3z',
    api: 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18',
    users: 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 7m2 4a6 6 0 0 1 3 6',
    account: 'M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10M3 22v-2a9 9 0 0 1 18 0v2',
    search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    plus: 'M12 4v16M4 12h16',
    logout: 'M9 3H3v18h6m5-15 6 6-6 6M8 12h12',
    box: 'm3 7 9-4 9 4v10l-9 4-9-4V7m0 0 9 4 9-4m-9 4v10',
  };
  return <svg width={Size} height={Size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={Paths[Name] || Paths.box}/></svg>;
}
export function Brand() { return <a className="brand" href="#home"><span className="brand-mark"><Icon Name="graph" Size={26}/></span><span>Abastece<span className="brand-light">Pyme</span><small>Conecta tu producción</small></span></a>; }
export function Heading({ Title, Description, Children }) { return <header className="page-heading"><div><h1>{Title}</h1><p>{Description}</p></div>{Children}</header>; }
export function Field({ Label, Hint, children }) { const Id = useId(); return <label className="field"><span>{Label}</span>{children}{Hint && <small id={Id}>{Hint}</small>}</label>; }
export function Notice({ Text, Error = false }) { return Text ? <div className={Error ? 'notice error' : 'notice'} role={Error ? 'alert' : 'status'}>{Text}</div> : null; }
export function Modal({ Title, OnClose, children }) {
  const Ref = useRef(null); const Id = useId();
  useEffect(() => { const Dialog = Ref.current; Dialog.showModal(); return () => Dialog.close(); }, []);
  return <dialog ref={Ref} aria-labelledby={Id} onCancel={OnClose}><div className="modal-title"><h2 id={Id}>{Title}</h2><button type="button" className="icon-button" aria-label="Cerrar ventana" onClick={OnClose}>×</button></div>{children}</dialog>;
}
export function Empty({ Text = 'Todavía no hay registros en esta sección.' }) { return <div className="empty"><Icon Name="box" Size={36}/><p>{Text}</p></div>; }
export function DemoBadge({ Value }) { return Value ? <span className="badge demo">Demostración</span> : <span className="badge">Confirmado</span>; }

