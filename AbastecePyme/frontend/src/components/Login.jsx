import { useState } from 'react';
import { Api, SetSession } from '../Api.js';
import { Brand, Field, Notice, Icon } from './Common.jsx';
export default function Login({ Register, OnSession }) {
  const [Busy, SetBusy] = useState(false); const [Error, SetError] = useState('');
  async function Submit(Event) {
    Event.preventDefault(); SetBusy(true); SetError('');
    const Form = new FormData(Event.currentTarget);
    const Body = {Username: Form.get('Username'), Password: Form.get('Password')};
    try {
      if (Register) await Api('/api/auth/register', {method:'POST',body:{...Body,DisplayName:Form.get('DisplayName')}});
      const Session = await Api('/api/auth/login',{method:'POST',body:Body});
      SetSession(Session); OnSession(Session); window.location.hash='dashboard';
    } catch (Failure) { SetError(Failure.message); } finally { SetBusy(false); }
  }
  return <div className="auth-page"><div className="auth-story"><Brand/><div><Icon Name="graph" Size={64}/><h1>Una vista completa de lo que hace posible tu producto.</h1><p>Vuelve a tu red de proveedores, insumos y productos.</p></div><a href="#home">Volver al inicio</a></div><main className="auth-main" id="main"><form className="auth-form" onSubmit={Submit}><p className="quiet">Tu espacio de trabajo</p><h2>{Register ? 'Crea tu cuenta' : 'Qué bueno tenerte aquí'}</h2><p>{Register ? 'Comienza con un perfil de consulta. Un administrador podrá ampliar tu acceso.' : 'Ingresa tus datos para continuar.'}</p><Notice Text={Error} Error/>
    {Register && <Field Label="Nombre"><input name="DisplayName" autoComplete="name" minLength={2} maxLength={80} required/></Field>}
    <Field Label="Usuario"><input name="Username" autoComplete="username" required minLength={Register?3:1} maxLength={40} pattern={Register?'[A-Za-z0-9_-]{3,40}':undefined} autoFocus/></Field>
    <Field Label="Contraseña" Hint={Register?'Usa entre 12 y 128 caracteres.':null}><input type="password" name="Password" required autoComplete={Register?'new-password':'current-password'} minLength={Register?12:1} maxLength={128}/></Field>
    <button className="primary" disabled={Busy}>{Busy?'Espera un momento…':Register?'Crear cuenta y entrar':'Iniciar sesión'} <Icon Name="arrow"/></button>
    <p className="auth-switch">{Register?'¿Ya tienes una cuenta?':'¿Es tu primera visita?'} <a href={Register?'#login':'#register'}>{Register?'Inicia sesión':'Crea una cuenta'}</a></p></form></main></div>;
}

