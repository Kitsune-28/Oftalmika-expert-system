import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './DoctorDashboard.css';
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

function DoctorDashboard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const isAuth = localStorage.getItem('isDoctorAuthenticated');
    if (!isAuth) {
      navigate('/doctor/login');
      return;
    }
    fetchSessions();
  }, [navigate]);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('doctorToken');
      const response = await axios.get(`${API_URL}/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(response.data);
    } catch (err) {
      console.error(err);
      setError("Не удалось загрузить данные сессий.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/doctor/login');
  };

  const getUrgencyLabel = (urgency) => {
    const u = String(urgency).toLowerCase();
    if (u === 'high') return 'Высокая';
    if (u === 'medium') return 'Средняя';
    if (u === 'low') return 'Низкая';
    return urgency;
  };

  const getGenderLabel = (gender) => {
    const g = String(gender).toLowerCase().trim();
    if (g === 'male') return 'Мужской';
    if (g === 'female') return 'Женский';
    return gender || 'Не указан';
  };

  const translateSurveyText = (text) => {
    if (!text) return '';
    const normalized = String(text).trim();

    if (SURVEY_TRANSLATIONS[normalized]) {
      return SURVEY_TRANSLATIONS[normalized];
    }

    if (normalized.includes(',')) {
      return normalized.split(',')
        .map(item => SURVEY_TRANSLATIONS[item.trim()] || item.trim())
        .join(', ');
    }

    return normalized;
  };

  const filteredSessions = sessions.filter(session => {
    const matchesUrgency = filterUrgency === 'all' || session.urgency === filterUrgency;
    const matchesSearch = 
      (session.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (session.lastName || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesUrgency && matchesSearch;
  });

  if (loading) return <div className="loading-screen">Загрузка данных...</div>;

  return (
    <div className="doctor-dashboard">
      <header className="site-header">
        <img src={logo} alt="Логотип клиники" className="fixed-logo-img" />
        <div className="header-actions">
          <button onClick={() => navigate('/')} className="btn-survey-nav">Форма опроса</button>
          <button onClick={handleLogout} className="btn-logout">Выход</button>
        </div>
      </header>

      <div className="container dashboard-container">
        <h1>Панель врача</h1>

        {error && <div className="error-message"><p>{error}</p></div>}

        <div className="filters-section">
          <input
            type="text"
            placeholder="Поиск по имени пациента..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select 
            value={filterUrgency} 
            onChange={(e) => setFilterUrgency(e.target.value)} 
            className="filter-select"
          >
            <option value="all">Все срочности</option>
            <option value="high">Высокая</option>
            <option value="medium">Средняя</option>
            <option value="low">Низкая</option>
          </select>
        </div>

        <div className="sessions-table-container">
          <table className="sessions-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Пациент</th>
                <th>Пол</th>
                <th>Возраст</th>
                <th>Диагноз</th>
                <th>Срочность</th>
                <th>Дата</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr><td colSpan="8" className="no-data">Нет данных по вашему запросу</td></tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id}>
                    <td>#{session.id}</td>
                    <td>{session.firstName} {session.lastName}</td>
                    <td>{getGenderLabel(session.gender)}</td>
                    <td>{session.age}</td>
                    <td className="diagnosis-cell">{session.diagnosis}</td>
                    <td>
                      <span className={`status-badge status-${session.urgency}`}>
                        {getUrgencyLabel(session.urgency)}
                      </span>
                    </td>
                    <td>{session.sessiontime}</td>
                    <td>
                      <button onClick={() => setSelectedSession(session)} className="btn-view">Просмотр</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedSession(null)}>×</button>
            <h2>Детали сессии #{selectedSession.id}</h2>

            <div className="session-info">
              <div className="info-row"><strong>Пациент:</strong> <span>{selectedSession.firstName} {selectedSession.lastName}</span></div>
              <div className="info-row"><strong>Пол:</strong> <span>{getGenderLabel(selectedSession.gender)}</span></div>
              <div className="info-row"><strong>Возраст:</strong> <span>{selectedSession.age}</span></div>
              <div className="info-row"><strong>Дата обращения:</strong> <span>{selectedSession.sessiontime}</span></div>
              <div className="info-row"><strong>Диагноз:</strong> <span>{selectedSession.diagnosis}</span></div>
              <div className="info-row">
                <strong>Срочность:</strong> 
                <span className={`status-badge status-${selectedSession.urgency}`}>
                  {getUrgencyLabel(selectedSession.urgency)}
                </span>
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
              ) : (
                <p>Нет ответов</p>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={() => setSelectedSession(null)} className="btn-view">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorDashboard;
