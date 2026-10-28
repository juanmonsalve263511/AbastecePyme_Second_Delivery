let CsrfToken = '';
export function SetSession(Session) { CsrfToken = Session?.CsrfToken || ''; }
export async function Api(Path, Options = {}) {
  if (!/^\/api\/[a-zA-Z0-9_/?=&%.-]+$/.test(Path)) throw new Error('Ruta de consulta inválida.');
  const Response = await fetch(Path, {
    credentials: 'same-origin', redirect: 'error', ...Options,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CsrfToken, ...Options.headers },
    body: Options.body === undefined ? undefined : JSON.stringify(Options.body)
  });
  const Data = await Response.json();
  if (!Response.ok) {
    const ErrorValue = new Error(Data.Detail || 'No se pudo completar la solicitud.');
    ErrorValue.Status = Response.status;
    if (Response.status === 401 && !Path.includes('/auth/')) window.dispatchEvent(new Event('session-expired'));
    throw ErrorValue;
  }
  return Data;
}
export const TypeLabels = { Supplier: 'Proveedor', Material: 'Insumo', Product: 'Producto' };
export const RoleLabels = { Administrator: 'Administrador', Editor: 'Editor', Viewer: 'Consulta' };
export function Quantity(Value, MinimumFraction = 0) {
  const [Integer,Fraction=''] = String(Value).split('.');
  const Grouped = Integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  const Digits = Fraction.replace(/0+$/,'').padEnd(MinimumFraction,'0');
  return Grouped + (Digits ? ','+Digits : '');
}
export const Money = Value => '$\u00a0'+Quantity(Value,2);

