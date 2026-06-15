import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './DoctorDashboard.css';
import './AdminDashboard.css';
import logo from './logo.png';

const API_URL = 'https://resourceful-recreation-production-5bdd.up.railway.app/api';

const SURVEY_TRANSLATIONS = {
  "none": "Нет потери зрения",
  "gradual": "Постепенное ухудшение",
  "progressive": "Постепенное ухудшение",
  "sudden": "Внезапное ухудшение",
  "fluctuating": "Колебания зрения",
  "temporary": "Временные нарушения",
  "floaters": "Мушки или точки перед глазами",
  "flashes": "Вспышки света",
  "halos": "Радужные круги вокруг источников света",
  "blur": "Затуманивание зрения",
  "blurred_vision": "Затуманивание зрения",
  "dryness": "Сухость, жжение, ощущение песка",
  "double_vision": "Двоение в глазах",
  "pain": "Боль в глазах",
  "redness": "Покраснение глаз",
  "tearing": "Слезотечение",
  "distortion": "Искажение линий",
  "less_4h": "Менее 4 часов",
  "less_6h": "Менее 6 часов",
  "more_6h": "6–8 часов",
  "more_8h": "Более 8 часов",
  "diabetes": "Сахарный диабет",
  "hypertension": "Гипертония",
  "autoimmune": "Аутоиммунные заболевания",
  "thyroid": "Заболевания щитовидной железы",
  "other": "Другие хронические заболевания",
  "no": "Нет",
  "sometimes": "Иногда",
  "yes": "Да",
  "migraine": "Мигрень",
  "yes_normal": "Да, было нормальным",
  "yes_high": "Да, было повышенным",
  "unknown": "Не помню / Не знаю",
  "less_1y": "Менее 1 года назад",
  "1_2y": "1–2 года назад",
  "1_3y": "1–3 года назад",
  "more_2y": "Более 2 лет назад",
  "more_3y": "Более 3 лет назад",
  "never": "Никогда",
  "right": "В правом",
  "left": "В левом",
  "both": "В обоих",
  "unsure": "Не уверен(а)",
  "controlled": "Да, регулярно слежу за сахаром",
  "uncontrolled": "Нет, уровень часто высокий",
  "unilateral": "Только одного глаза",
  "bilateral": "Обоих глаз",
  "mild": "Лёгкий дискомфорт",
  "moderate": "Умеренная боль",
  "severe": "Сильная, невыносимая боль",
  "lighting": "При смене освещения",
  "fatigue": "Ближе к вечеру / при усталости",
  "time_of_day": "В определённое время суток",
};

const URGENCY_RU = {
  high: 'Высокая',
  medium: 'Средняя',
  low: 'Низкая'
};

function AdminDashboard() {
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('sessions');
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [editModal, setEditModal] = useState({ isOpen: false, data: null });
  const [formData, setFormData] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    login: '',
    password: '',
    role: 'doctor',
    is_active: true
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  
  const navigate = useNavigate();

  // 1. Оборачиваем fetchData в useCallback. 
  // Массив зависимостей пустой [], так как внутри используются только стабильные setState и локальные переменные.
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Создаем token и config внутри функции, чтобы избежать пересоздания ссылки на объект при каждом рендере
      const token = localStorage.getItem('doctorToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [sessRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/admin/sessions`, config),
        axios.get(`${API_URL}/admin/users`, config)
      ]);
      setSessions(sessRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error(err);
      setError('Ошибка загрузки данных. Проверьте подключение или права доступа.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Добавляем fetchData в массив зависимостей useEffect
  useEffect(() => {
    if (localStorage.getItem('userRole') !== 'admin') {
      navigate('/doctor/login');
      return;
    }
    fetchData();
  }, [navigate, fetchData]);

  const filteredSessions = sessions.filter(s => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (s.firstName || '').toLowerCase().includes(searchLower) ||
      (s.lastName || '').toLowerCase().includes(searchLower)
    );
  });

  const filteredUsers = users.filter(u => {
    return (u.login || '').toLowerCase().includes(userSearchTerm.toLowerCase());
  });

  const getGenderLabel = (gender) => {
    const g = String(gender).toLowerCase().trim();
    return g === 'male' ? 'Мужской' : g === 'female' ? 'Женский' : gender || 'Не указан';
  };

  const getUrgencyLabel = (urgency) => URGENCY_RU[urgency?.toLowerCase()] || urgency;

  const translateSurveyText = (text) => {
    if (!text) return '';
    const normalized = String(text).trim();
    return SURVEY_TRANSLATIONS[normalized] ||
      (normalized.includes(',')
        ? normalized.split(',').map(t => SURVEY_TRANSLATIONS[t.trim()] || t.trim()).join(', ')
        : normalized);
  };

  // 3. Обновленные функции с локальным созданием config
  const handleDelete = async (type, id, userLogin) => {
    const currentLogin = localStorage.getItem('doctorLogin');
    if (type === 'users' && userLogin === currentLogin) {
      alert('Вы не можете удалить свою собственную учётную запись!');
      return;
    }
    if (!window.confirm('Вы уверены, что хотите удалить эту запись?')) return;

    try {
      const token = localStorage.getItem('doctorToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      await axios.delete(`${API_URL}/admin/${type}/${id}`, config);
      fetchData();
    } catch (err) {
      alert('Ошибка удаления: ' + (err.response?.data?.detail || err.message));
    }
  };

  const openEditUser = (user) => {
    setEditModal({ isOpen: true, data: user });
    setFormData({ ...user });
    setShowEditPassword(false);
  };

  const handleUpdateUser = async () => {
    try {
      const token = localStorage.getItem('doctorToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      await axios.put(`${API_URL}/admin/users/${formData.id}`, formData, config);
      setEditModal({ isOpen: false, data: null });
      fetchData();
    } catch (err) {
      alert('Ошибка обновления: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateUser = async () => {
    try {
      const token = localStorage.getItem('doctorToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      await axios.post(`${API_URL}/admin/users`, newUser, config);
      setShowCreateModal(false);
      setNewUser({ login: '', password: '', role: 'doctor', is_active: true });
      setShowCreatePassword(false);
      fetchData();
    } catch (err) {
      alert('Ошибка создания пользователя: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/doctor/login');
  };

  if (loading) return <div className="loading-screen">Загрузка данных...</div>;

  return (
    <div className="doctor-dashboard">
      <header className="site-header">
        <img src={logo} alt="Логотип" className="fixed-logo-img" />
        <div className="header-actions">
          <button onClick={() => navigate('/')} className="btn-survey-nav">Форма опроса</button>
          <button onClick={handleLogout} className="btn-logout">Выход</button>
        </div>
      </header>

      <div className="admin-dashboard-container">
        <h1 className="admin-title">Панель администратора</h1>

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        <div className="admin-tabs">
          <button 
            className={`admin-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`} 
            onClick={() => setActiveTab('sessions')}
          >
            Сессии пациентов
          </button>
          <button 
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`} 
            onClick={() => setActiveTab('users')}
          >
            Пользователи системы
          </button>
        </div>

        {activeTab === 'sessions' && (
          <>
            <div className="search-container">
              <div className="filters-section" style={{ margin: '0', justifyContent: 'flex-start', padding: '20px 20px' }}>
                <input
                  type="text"
                  placeholder="Поиск по имени или фамилии пациента..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                  style={{ maxWidth: '420px', margin: 0 }}
                />
              </div>
            </div>

            <div className="table-container" style={{ marginTop: '0' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '70px' }}>ID</th>
                    <th style={{ width: '190px' }}>Пациент</th>
                    <th style={{ width: '80px' }}>Возраст</th>
                    <th>Диагноз</th>
                    <th style={{ width: '120px' }}>Срочность</th>
                    <th style={{ width: '150px' }}>Дата</th>
                    <th style={{ width: '200px' }} className="text-center">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="no-data">Нет данных по вашему запросу</td>
                    </tr>
                  ) : (
                    filteredSessions.map(s => (
                      <tr key={s.id}>
                        <td><strong>#{s.id}</strong></td>
                        <td>{s.firstName} {s.lastName}</td>
                        <td className="text-center">{s.age}</td>
                        <td>{s.diagnosis}</td>
                        <td className="text-center">
                          <span className={`status-badge status-${s.urgency}`}>
                            {getUrgencyLabel(s.urgency)}
                          </span>
                        </td>
                        <td>{s.sessiontime}</td>
                        <td className="text-center actions-cell">
                          <button onClick={() => setSelectedSession(s)} className="btn-view action-btn">Просмотреть</button>
                          <button onClick={() => handleDelete('sessions', s.id)} className="btn-admin-delete action-btn">Удалить</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <>
            <div className="search-container">
              <div className="filters-section" style={{ margin: '0', justifyContent: 'space-between', padding: '20px', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <input
                  type="text"
                  placeholder="Поиск по логину..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="search-input"
                  style={{ maxWidth: '420px', margin: 0 }}
                />
                <button 
                  onClick={() => setShowCreateModal(true)} 
                  className="btn-admin-edit" 
                  style={{ minWidth: '240px', padding: '12px 24px' }}
                >
                  + Добавить нового пользователя
                </button>
              </div>
            </div>

            <div className="table-container" style={{ marginTop: '0' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '70px' }}>ID</th>
                    <th style={{ width: '160px' }}>Логин</th>
                    <th style={{ width: '130px' }}>Роль</th>
                    <th style={{ width: '110px' }}>Статус</th>
                    <th style={{ width: '200px' }} className="text-center">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data">Нет данных по вашему запросу</td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const currentLogin = localStorage.getItem('doctorLogin');
                      const isCurrentUser = u.login === currentLogin;
                      return (
                        <tr key={u.id}>
                          <td>#{u.id}</td>
                          <td><strong>{u.login}</strong></td>
                          <td>{u.role === 'admin' ? 'Администратор' : 'Врач'}</td>
                          <td className="text-center">
                            <span className={u.is_active ? 'user-status-active' : 'user-status-inactive'}>
                              {u.is_active ? 'Активен' : 'Заблокирован'}
                            </span>
                          </td>
                          <td className="text-center actions-cell">
                            <button onClick={() => openEditUser(u)} className="btn-admin-edit action-btn">Изменить</button>
                            <button 
                              onClick={() => handleDelete('users', u.id, u.login)} 
                              className="btn-admin-delete action-btn" 
                              disabled={isCurrentUser}
                              title={isCurrentUser ? "Нельзя удалить свою учётную запись" : "Удалить пользователя"}
                              style={isCurrentUser ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                              Удалить
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedSession(null)}>×</button>
            <h2>Детали сессии #{selectedSession.id}</h2>

            <div className="session-info">
              <div className="info-row"><strong>Пациент:</strong> <span>{selectedSession.firstName} {selectedSession.lastName}</span></div>
              <div className="info-row"><strong>Пол:</strong> <span>{getGenderLabel(selectedSession.gender)}</span></div>
              <div className="info-row"><strong>Возраст:</strong> <span>{selectedSession.age}</span></div>
              <div className="info-row"><strong>Дата:</strong> <span>{selectedSession.sessiontime}</span></div>
              <div className="info-row"><strong>Диагноз:</strong> <span>{selectedSession.diagnosis}</span></div>
              <div className="info-row">
                <strong>Срочность:</strong> 
                <span className={`status-badge status-${selectedSession.urgency}`}>{getUrgencyLabel(selectedSession.urgency)}</span>
              </div>
            </div>

            <div className="answers-section">
              <h3>Ответы пациента</h3>
              {selectedSession.answers && selectedSession.answers.length > 0 ? (
                <div className="answers-list">
                  {selectedSession.answers.map((answer, index) => (
                    <div key={index} className="answer-item">
                      <strong>{answer.questionText}</strong>
                      <p>{translateSurveyText(answer.answer)}</p>
                    </div>
                  ))}
                </div>
              ) : <p>Нет ответов</p>}
            </div>

            <div className="modal-actions">
              <button onClick={() => setSelectedSession(null)} className="btn-view">Закрыть</button>
            </div>
          </div>
        </div>
      )}

      {editModal.isOpen && (
        <div className="modal-overlay" onClick={() => setEditModal({ isOpen: false, data: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Редактирование пользователя</h2>
            <div className="modal-form">
              <input 
                placeholder="Логин" 
                value={formData.login || ''} 
                onChange={e => setFormData({...formData, login: e.target.value})} 
                className="admin-input" 
              />
              <select 
                value={formData.role || ''} 
                onChange={e => setFormData({...formData, role: e.target.value})} 
                className="admin-input"
              >
                <option value="doctor">Врач</option>
                <option value="admin">Администратор</option>
              </select>
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={formData.is_active} 
                  onChange={e => setFormData({...formData, is_active: e.target.checked})} 
                />
                <span>Активен</span>
              </label>
              
              <div className="password-input-wrapper">
                <input 
                  placeholder="Новый пароль (оставьте пустым, если не меняете)" 
                  type={showEditPassword ? "text" : "password"} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  className="admin-input" 
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowEditPassword(!showEditPassword)}
                  aria-label={showEditPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showEditPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.2 4" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditModal({ isOpen: false, data: null })} className="btn-admin-cancel">Отмена</button>
              <button onClick={handleUpdateUser} className="btn-admin-edit">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Создать нового пользователя</h2>
            <div className="modal-form">
              <input 
                placeholder="Логин" 
                value={newUser.login} 
                onChange={e => setNewUser({...newUser, login: e.target.value})} 
                className="admin-input" 
              />
              
              <div className="password-input-wrapper">
                <input 
                  placeholder="Пароль" 
                  type={showCreatePassword ? "text" : "password"} 
                  value={newUser.password} 
                  onChange={e => setNewUser({...newUser, password: e.target.value})} 
                  className="admin-input" 
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  aria-label={showCreatePassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  {showCreatePassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.2 4" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              
              <select 
                value={newUser.role} 
                onChange={e => setNewUser({...newUser, role: e.target.value})} 
                className="admin-input"
              >
                <option value="doctor">Врач</option>
                <option value="admin">Администратор</option>
              </select>
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={newUser.is_active} 
                  onChange={e => setNewUser({...newUser, is_active: e.target.checked})} 
                />
                <span>Активен</span>
              </label>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="btn-admin-cancel">Отмена</button>
              <button onClick={handleCreateUser} className="btn-admin-edit">Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
