import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './DoctorLogin.css';
import logo from './logo.png';

const API_URL = 'resourceful-recreation-production-5bdd.up.railway.app';

function DoctorLogin() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Неверный логин или пароль');
      }

      localStorage.setItem('doctorToken', data.access_token);
      localStorage.setItem('doctorLogin', login.trim());
      localStorage.setItem('isDoctorAuthenticated', 'true');
      localStorage.setItem('doctorLoginTime', new Date().toISOString());
      localStorage.setItem('userRole', data.role);

      navigate(data.role === 'admin' ? '/admin' : '/doctor');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="doctor-login-page">
      <header className="site-header">
        <img src={logo} alt="Логотип клиники" className="fixed-logo-img" />
      </header>
      <div className="login-container">
        <div className="login-card">
          <h1>Авторизация персонала</h1>
          <p className="login-subtitle">Введите свои данные для входа в систему</p>

          {error && <div className="error-message" role="alert">{error}</div>}

          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label htmlFor="login">Логин</label>
              <input
                type="text"
                id="login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Введите логин"
                required
                autoComplete="username"
                className="login-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Пароль</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  required
                  autoComplete="current-password"
                  className="login-input"
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-controls">
              <button 
                type="button" 
                onClick={() => navigate('/')} 
                className="btn-back"
              >
                Назад к опросу
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className="btn-login"
              >
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default DoctorLogin;
