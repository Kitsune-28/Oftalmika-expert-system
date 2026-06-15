import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './App.css';
import logo from './logo.png';
import eyeIcon from './spec-vrs.png';
import DoctorLogin from './DoctorLogin';
import DoctorDashboard from './DoctorDashboard';
import AdminDashboard from './AdminDashboard';

const API_URL = 'https://resourceful-recreation-production-5bdd.up.railway.app/api';
const STORAGE_KEY = 'patientSurveyProgress_v2';

function PatientSurvey() {
  const [step, setStep] = useState(0);
  const [staticQuestions, setStaticQuestions] = useState([]);
  const [dynamicQuestions, setDynamicQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [userData, setUserData] = useState({
    firstName: '', lastName: '', gender: '', age: ''
  });
  const [consentChecked, setConsentChecked] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [accessibleMode, setAccessibleMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedState, setSavedState] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const currentQuestion = step > 0 ? questions[step - 1] : null;
  const navigate = useNavigate();

  const logoRef = useRef(null);
  const accessButtonRef = useRef(null);
  const optionsRefs = useRef([]);
  const backButtonRef = useRef(null);
  const nextButtonRef = useRef(null);
  const restartButtonRef = useRef(null);
  const detailsButtonRef = useRef(null);
  const doctorButtonRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const isEmpty =
          parsed.step === 0 &&
          !parsed.userData?.firstName &&
          !parsed.userData?.lastName &&
          !parsed.userData?.gender &&
          !parsed.userData?.age &&
          !parsed.consentChecked;

        if (!isEmpty) {
          setSavedState(parsed);
          setShowResumePrompt(true);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && !showResumePrompt) {
      const hasMeaningful =
        step > 0 ||
        Object.values(userData).some(Boolean) ||
        consentChecked ||
        isFinished;

      if (hasMeaningful) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ step, answers, userData, consentChecked, isFinished, result, showDetails })
        );
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [step, answers, userData, consentChecked, isFinished, result, showDetails, loading, showResumePrompt]);

  useEffect(() => {
    axios
      .get(`${API_URL}/questions`)
      .then(r => setStaticQuestions(r.data))
      .catch(e => console.error('Ошибка загрузки вопросов:', e))
      .finally(() => setLoading(false));
  }, []);

  const refreshDynamicQuestions = useCallback(
    async (currentAnswers, currentUser) => {
      if (!currentUser?.age) {
        setDynamicQuestions([]);
        return;
      }
      try {
        const { data } = await axios.post(`${API_URL}/questions/dynamic`, {
          answers: currentAnswers,
          user: currentUser,
        });
        setDynamicQuestions(data.questions || []);
      } catch (e) {
        console.error('Ошибка загрузки динамических вопросов:', e);
      }
    },
    []
  );

  useEffect(() => {
    const merged = [
      ...staticQuestions,
      ...dynamicQuestions.filter(dq => !staticQuestions.find(sq => sq.id === dq.id)),
    ];
    setQuestions(merged);
  }, [staticQuestions, dynamicQuestions]);

  useEffect(() => {
    if (userData.age && Object.keys(answers).length > 0) {
      refreshDynamicQuestions(answers, {
        firstName: userData.firstName,
        lastName: userData.lastName,
        gender: userData.gender,
        age: parseInt(userData.age) || 0,
      });
    }
  }, [answers, userData, refreshDynamicQuestions]);

  useEffect(() => {
    document.body.classList.toggle('accessible-mode', accessibleMode);
  }, [accessibleMode]);

  useEffect(() => {
    if (currentQuestion) {
      optionsRefs.current = optionsRefs.current.slice(0, currentQuestion.options?.length || 0);
    }
  }, [step, currentQuestion]);

  const generatePDFBase64 = () =>
    new Promise((resolve) => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.addFont(
        'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf',
        'Roboto', 'normal'
      );
      doc.addFont(
        'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf',
        'Roboto', 'bold'
      );
      doc.setFont('Roboto');

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;

      const generateContent = (logoBottomY = 0) => {
        const startY = Math.max(logoBottomY, 44);
        doc.setFontSize(16.5);
        doc.text('Результаты предварительного анализа зрения', pageWidth / 2, startY, { align: 'center' });

        let y = startY + 11;
        doc.setFontSize(11.5);
        doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, margin, y); y += 7;
        doc.text(`Пациент: ${userData.firstName} ${userData.lastName}`, margin, y); y += 7;
        doc.text(`Возраст: ${userData.age} лет`, margin, y); y += 7;
        doc.text(`Пол: ${userData.gender === 'male' ? 'Мужской' : 'Женский'}`, margin, y);

        y += 14;
        doc.setFontSize(13.5);
        doc.text('Предварительный диагноз:', margin, y);

        y += 8;
        doc.setFontSize(12.5);
        if (result.urgency === 'high') doc.setTextColor(200, 0, 0);
        else if (result.urgency === 'medium') doc.setTextColor(255, 140, 0);
        else doc.setTextColor(0, 128, 0);

        const diagLines = doc.splitTextToSize(result.diagnosis, pageWidth - margin * 2 - 10);
        doc.text(diagLines, margin, y);
        y += diagLines.length * 6.5 + 4;

        doc.setTextColor(0);
        doc.setFontSize(12);
        const urgLabel = result.urgency === 'high' ? 'Высокая' : result.urgency === 'medium' ? 'Средняя' : 'Низкая';
        doc.text(`Срочность: ${urgLabel}`, margin, y);

        const tableData = questions
          .map(q => {
            const ans = answers[q.id];
            if (!ans || (Array.isArray(ans) && ans.length === 0)) return null;
            const ansText = Array.isArray(ans)
              ? ans.map(v => q.options?.find(o => o.value === v)?.label || v).join(', ')
              : q.options?.find(o => o.value === ans)?.label || String(ans);
            return [q.text, ansText];
          })
          .filter(Boolean);

        autoTable(doc, {
          startY: y + 13,
          head: [['Вопрос', 'Ответ']],
          body: tableData,
          theme: 'grid',
          styles: { font: 'Roboto', fontSize: 9.5, cellPadding: 4.5 },
          headStyles: { fillColor: [255, 104, 5], textColor: 255, fontStyle: 'bold', font: 'Roboto' },
          margin: { left: margin, right: margin },
        });

        const finalY = (doc.lastAutoTable?.finalY || y + 75) + 15;
        doc.setFontSize(10.5);
        doc.text('Это предварительный анализ на основе ваших ответов.', margin, finalY);
        doc.text('Рекомендуется обратиться к врачу-офтальмологу для точной диагностики.', margin, finalY + 7);

        resolve(doc.output('datauristring').split(',')[1]);
      };

      if (!logo) { generateContent(0); return; }
      const img = new Image();
      img.src = logo;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          canvas.getContext('2d').drawImage(img, 0, 0);
          const lw = 45, lh = (img.height / img.width) * lw;
          doc.addImage(canvas.toDataURL('image/png', 0.9), 'PNG', margin, 10, lw, lh);
          generateContent(10 + lh + 1);
        } catch { generateContent(0); }
      };
      if (img.complete) img.onload();
    });

  const exportToPDF = () => {
    if (!result || !userData.firstName) { alert('Нет данных для экспорта'); return; }
    generatePDFBase64().then(b64 => {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${b64}`;
      link.download = `Диагноз_${userData.lastName || 'Пациент'}_${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
    });
  };

  const sendToEmail = async () => {
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      setEmailError('Введите корректный email адрес');
      return;
    }
    setIsSending(true);
    setEmailError('');
    try {
      const b64 = await generatePDFBase64();
      await axios.post(`${API_URL}/send-pdf-email`, {
        email: emailInput,
        pdf_base64: b64,
        patient_name: `${userData.firstName} ${userData.lastName || ''}`.trim(),
        gender: userData.gender,
      });
      alert('Результаты успешно отправлены на вашу почту!');
      setShowEmailModal(false);
      setEmailInput('');
    } catch {
      alert('Не удалось отправить письмо. Попробуйте позже.');
    } finally {
      setIsSending(false);
    }
  };

  const handleOptionSelect = (questionId, value) => {
    const question = questions.find(q => q.id === questionId);
    if (question?.type === 'single') {
      setAnswers(prev => ({ ...prev, [questionId]: value }));
    } else {
      const current = answers[questionId] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : value === 'none'
        ? ['none']
        : [...current.filter(v => v !== 'none'), value];
      setAnswers(prev => ({ ...prev, [questionId]: next }));
    }
  };

  const isNextDisabled =
    !currentQuestion ||
    !answers[currentQuestion?.id] ||
    (Array.isArray(answers[currentQuestion?.id]) && answers[currentQuestion?.id].length === 0);

  const handleNext = async () => {
    if (step === 0) {
      await refreshDynamicQuestions({}, {
        firstName: userData.firstName,
        lastName: userData.lastName,
        gender: userData.gender,
        age: parseInt(userData.age) || 0,
      });
      setStep(1);
    } else if (step < questions.length) {
      setStep(step + 1);
    } else {
      setAnalyzing(true);
      try {
        const payload = {
          answers,
          user: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            gender: userData.gender,
            age: parseInt(userData.age),
          },
        };
        const response = await axios.post(`${API_URL}/analyze`, payload);
        setResult(response.data);
        setIsFinished(true);
      } catch (error) {
        console.error('Ошибка анализа:', error);
        alert('Произошла ошибка при анализе данных');
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 1) setStep(0);
    else if (step > 1) setStep(step - 1);
  };

  const restart = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStep(0);
    setAnswers({});
    setUserData({ firstName: '', lastName: '', gender: '', age: '' });
    setConsentChecked(false);
    setIsFinished(false);
    setResult(null);
    setShowDetails(false);
    setDynamicQuestions([]);
  };

  const toggleAccessibleMode = () => setAccessibleMode(v => !v);
  
  // ИЗМЕНЕННАЯ ФУНКЦИЯ - автоматически выключает версию для слабовидящих
  const handleGoToDoctor = () => {
    if (accessibleMode) {
      document.body.classList.remove('accessible-mode');
      setAccessibleMode(false);
    }
    navigate('/doctor/login');
  };

  const isOptionSelected = val => {
    if (!currentQuestion) return false;
    return currentQuestion.type === 'single'
      ? answers[currentQuestion.id] === val
      : answers[currentQuestion.id]?.includes(val);
  };

  const formatAnswer = (questionId, answerValue) => {
    const question = questions.find(q => q.id === questionId);
    if (!question) return String(answerValue);
    const opts = question.options || [];
    if (Array.isArray(answerValue))
      return answerValue.map(v => opts.find(o => o.value === v)?.label || v).join(', ');
    return opts.find(o => o.value === answerValue)?.label || String(answerValue);
  };

  const handleNameChange = (field, value) =>
    setUserData(prev => ({ ...prev, [field]: value.replace(/[^a-zA-Zа-яА-ЯёЁ\s-]/g, '') }));

  const handleAgeChange = value => {
    const num = value.replace(/[^0-9]/g, '');
    if (num === '' || (parseInt(num) >= 1 && parseInt(num) <= 120))
      setUserData(prev => ({ ...prev, age: num }));
  };

  const isRegisterNextDisabled =
    !userData.firstName || !userData.lastName || !userData.gender || !userData.age ||
    parseInt(userData.age) < 1 || parseInt(userData.age) > 120 || !consentChecked;

  const handleResume = () => {
    if (savedState) {
      setStep(savedState.step ?? 0);
      setAnswers(savedState.answers ?? {});
      setUserData(savedState.userData ?? { firstName: '', lastName: '', gender: '', age: '' });
      setConsentChecked(savedState.consentChecked ?? false);
      setIsFinished(savedState.isFinished ?? false);
      setResult(savedState.result ?? null);
      setShowDetails(savedState.showDetails ?? false);
    }
    setShowResumePrompt(false);
    setSavedState(null);
  };

  const handleStartOver = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedState(null);
    setShowResumePrompt(false);
    restart();
  };

  const DynamicBadge = () => (
    <span style={{
      display: 'inline-block', marginBottom: '10px',
      padding: '3px 10px', borderRadius: '12px',
      fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em',
      background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80',
    }}>
      Уточняющий вопрос
    </span>
  );

  const Header = () => (
    <header className="site-header">
      <a 
        href="https://oftalmika.su" 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ display: 'inline-block', textDecoration: 'none' }}
      >
        <img 
          ref={logoRef} 
          src={logo} 
          alt="Логотип клиники" 
          className="fixed-logo-img" 
          tabIndex="0"
          style={{ cursor: 'pointer' }}
        />
      </a>
      <div className="header-actions">
        {step === 0 && (
          <button ref={doctorButtonRef} onClick={handleGoToDoctor} className="btn-doctor-nav">
            Форма врача
          </button>
        )}
        <button ref={accessButtonRef} onClick={toggleAccessibleMode} className="accessibility-toggle">
          <img src={eyeIcon} alt="" className="accessibility-icon" />
          <span>{accessibleMode ? 'Обычная версия' : 'Версия для слабовидящих'}</span>
        </button>
      </div>
    </header>
  );

  if (loading) return <div className="loading-screen">Загрузка опроса...</div>;

  if (showResumePrompt) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '15px',
      }}>
        <div style={{
          background: '#fff', padding: '30px 25px', borderRadius: '16px',
          textAlign: 'center', maxWidth: '420px', width: '100%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)', border: '1px solid #e0e0e0',
        }}>
          <h3 style={{ marginBottom: '18px', color: '#222', fontSize: '1.4rem' }}>Продолжить опрос?</h3>
          <p style={{ marginBottom: '28px', color: '#555', lineHeight: '1.55', fontSize: '1.02rem' }}>
            У вас есть сохранённый прогресс. <br />Хотите продолжить?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={handleResume} className="btn-primary" style={{ padding: '15px', fontSize: '1.05rem' }}>
              Продолжить опрос
            </button>
            <button onClick={handleStartOver} className="btn-secondary" style={{ padding: '15px', fontSize: '1.05rem' }}>
              Начать заново
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${((step + (isFinished ? 1 : 0)) / (questions.length + 1)) * 100}%`,
            }}
          />
        </div>

        {isFinished && result ? (
          <div className="result-card">
            <h2>Результаты предварительного анализа</h2>

            <div className={`status-badge status-${result.urgency}`}>
              Срочность: {result.urgency === 'high' ? 'Высокая' : result.urgency === 'medium' ? 'Средняя' : 'Низкая'}
            </div>

            <p className="diagnosis-text">{result.diagnosis}</p>

            {result.diagnoses && result.diagnoses.length > 1 && (
              <div style={{ marginTop: '16px', padding: '16px', background: '#f8f9fa', borderRadius: '10px', textAlign: 'left' }}>
                <p style={{ fontWeight: 600, marginBottom: '10px', color: '#333' }}>Также возможно:</p>
                {result.diagnoses.slice(1).map((d, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 0', borderBottom: i < result.diagnoses.length - 2 ? '1px solid #eee' : 'none',
                  }}>
                    <span style={{
                      width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                      background: d.urgency === 'high' ? '#e53935' : d.urgency === 'medium' ? '#fb8c00' : '#43a047',
                    }} />
                    <span style={{ fontSize: '0.93rem', color: '#444' }}>{d.diagnosis}</span>
                  </div>
                ))}
              </div>
            )}

            {showDetails && (
              <div className="details-block" style={{
                textAlign: 'left', marginTop: '30px', padding: '25px',
                borderTop: '2px solid #eee', backgroundColor: '#fafafa', borderRadius: '8px',
              }}>
                <h3>Детали обращения</h3>
                <p><strong>Имя:</strong> {userData.firstName} {userData.lastName}</p>
                <p><strong>Пол:</strong> {userData.gender === 'male' ? 'Мужской' : 'Женский'}</p>
                <p><strong>Возраст:</strong> {userData.age}</p>

                <h4 style={{ marginTop: '25px', marginBottom: '12px' }}>Ответы на вопросы</h4>
                {questions.map(q => {
                  const answer = answers[q.id];
                  if (!answer || (Array.isArray(answer) && answer.length === 0)) return null;
                  return (
                    <div key={q.id} style={{ marginBottom: '14px' }}>
                      <strong>
                        {q.dynamic && (
                          <span style={{
                            fontSize: '0.72rem', color: '#e65100',
                            background: '#fff3e0', borderRadius: '8px',
                            padding: '1px 7px', marginRight: '6px',
                          }}>уточн.</span>
                        )}
                        {q.text}
                      </strong>
                      <div style={{ marginLeft: '15px', color: '#555', marginTop: '4px' }}>
                        {formatAnswer(q.id, answer)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="controls" style={{
              flexDirection: 'column', gap: '14px', alignItems: 'center', marginTop: '35px', width: '100%',
            }}>
              <button
                ref={detailsButtonRef}
                onClick={() => setShowDetails(v => !v)}
                className="btn-primary"
                style={{ width: '100%', maxWidth: '340px', padding: '15px' }}
              >
                {showDetails ? 'Скрыть подробности' : 'Подробнее'}
              </button>

              {showDetails && (
                <>
                  <button onClick={exportToPDF} className="btn-primary" style={{ width: '100%', maxWidth: '340px', padding: '15px' }}>
                    Скачать PDF
                  </button>
                  <button onClick={() => setShowEmailModal(true)} className="btn-primary" style={{ width: '100%', maxWidth: '340px', padding: '15px' }}>
                    Отправить PDF на email
                  </button>
                </>
              )}

              <button
                ref={restartButtonRef}
                onClick={restart}
                className="btn-secondary"
                style={{ width: '100%', maxWidth: '340px', padding: '15px' }}
              >
                Пройти опрос заново
              </button>
            </div>
          </div>

        ) : step === 0 ? (
          <div className="question-card reg-card">
            <h2>Регистрация</h2>
            <p>Пожалуйста, введите ваши данные</p>
            <div className="registration-form">
              <input type="text" placeholder="Имя" value={userData.firstName}
                onChange={e => handleNameChange('firstName', e.target.value)} className="reg-input" />
              <input type="text" placeholder="Фамилия" value={userData.lastName}
                onChange={e => handleNameChange('lastName', e.target.value)} className="reg-input" />
              <div className="gender-group">
                <label>
                  <input type="radio" name="gender" value="male"
                    checked={userData.gender === 'male'}
                    onChange={e => setUserData(prev => ({ ...prev, gender: e.target.value }))} />
                  {' '}Мужской
                </label>
                <label>
                  <input type="radio" name="gender" value="female"
                    checked={userData.gender === 'female'}
                    onChange={e => setUserData(prev => ({ ...prev, gender: e.target.value }))} />
                  {' '}Женский
                </label>
              </div>
              <input type="text" placeholder="Возраст" value={userData.age}
                onChange={e => handleAgeChange(e.target.value)} className="reg-input" />
              
              <div className="consent-group">
                <label className="consent-label" style={{ display: 'block', lineHeight: '1.6' }}>
                  <input type="checkbox" checked={consentChecked}
                    onChange={e => setConsentChecked(e.target.checked)} className="consent-checkbox" />
                  <span style={{ display: 'inline' }}>
                    Я согласен(а) на обработку персональных данных в соответствии с{' '}
                    <a 
                      href="https://oftalmika.su/privacy-policy/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={{ 
                        color: 'orange', 
                        textDecoration: 'underline', 
                        fontWeight: 'bold',
                        display: 'inline'
                      }}
                    >
                      политикой конфиденциальности
                    </a>
                  </span>
                </label>
              </div>
            </div>
            <div className="controls nav-controls">
              <button onClick={handleBack} className="btn-text">Назад</button>
              <button onClick={handleNext} disabled={isRegisterNextDisabled} className="btn-primary">Далее</button>
            </div>
          </div>

        ) : (
          currentQuestion && (
            <div className="question-card">
              <h3>Вопрос {step} из {questions.length}</h3>

              {currentQuestion.dynamic && <DynamicBadge />}

              <h2>{currentQuestion.text}</h2>

              <div className="options-grid">
                {currentQuestion.options?.map((opt, idx) => (
                  <button
                    key={opt.value}
                    ref={el => (optionsRefs.current[idx] = el)}
                    className={`option-btn ${isOptionSelected(opt.value) ? 'selected' : ''}`}
                    onClick={() => handleOptionSelect(currentQuestion.id, opt.value)}
                    tabIndex={0}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="controls nav-controls">
                <button ref={backButtonRef} onClick={handleBack} className="btn-text">Назад</button>
                <button
                  ref={nextButtonRef}
                  onClick={handleNext}
                  disabled={isNextDisabled || analyzing}
                  className="btn-primary"
                >
                  {analyzing ? 'Анализируем...' : step === questions.length ? 'Завершить' : 'Далее'}
                </button>
              </div>
            </div>
          )
        )}
      </main>

      {showEmailModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 4000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '15px',
        }}>
          <div style={{
            background: '#fff', padding: '30px', borderRadius: '16px',
            width: '100%', maxWidth: '420px', textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h3 style={{ marginBottom: '10px' }}>Отправить результаты</h3>
            <p style={{ marginBottom: '20px', color: '#555' }}>PDF-файл будет отправлен на указанный email</p>

            <input
              type="email"
              placeholder="ваша_почта@email.ru"
              value={emailInput}
              onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
              style={{
                width: '100%', padding: '14px', fontSize: '1.05rem',
                border: emailError ? '2px solid red' : '2px solid #ddd',
                borderRadius: '8px', marginBottom: '10px', boxSizing: 'border-box',
              }}
            />
            {emailError && <p style={{ color: 'red', margin: '8px 0' }}>{emailError}</p>}

            <div style={{ display: 'flex', gap: '12px', marginTop: '25px' }}>
              <button
                onClick={() => { setShowEmailModal(false); setEmailInput(''); setEmailError(''); }}
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
              >
                Отмена
              </button>
              <button
                onClick={sendToEmail}
                disabled={isSending}
                className="btn-primary"
                style={{ flex: 1, padding: '14px' }}
              >
                {isSending ? 'Отправляем...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PatientSurvey />} />
        <Route path="/doctor/login" element={<DoctorLogin />} />
        <Route path="/doctor" element={<DoctorDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
