from typing import Dict, Any, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from app.core.database import get_main_db
from dataclasses import dataclass, field
from operator import attrgetter
from collections import defaultdict

@dataclass
class Fact:
    age: int = 0
    gender: str = None
    vision_loss: str = None
    symptoms: List[str] = field(default_factory=list)
    work_habits: str = None
    history: str = None
    headache: str = None
    high_iop: str = None
    family_history: str = None
    last_check: str = None
    affected_eye: str = None
    floaters_progressing: str = None
    diabetes_control: str = None
    using_drops: str = None
    blur_laterality: str = None
    pain_level: str = None
    central_vision_loss: str = None
    fluctuation_trigger: str = None 
    exophthalmos: str = None
    aura: str = None

@dataclass
class Rule:
    name: str
    conditions: dict
    diagnosis_id: int
    score: int
    priority: int = 50
    boosts: List[int] = field(default_factory=list)

STATIC_QUESTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

DYNAMIC_QUESTION_CONDITIONS = {
    9:  lambda answers, user: answers.get("1") == "sudden",
    10: lambda answers, user: isinstance(answers.get("2"), list) and
                              any(s in answers.get("2", []) for s in ["floaters", "flashes"]),
    11: lambda answers, user: answers.get("4") == "diabetes",
    12: lambda answers, user: answers.get("6") == "yes_high" or answers.get("7") == "yes",
    13: lambda answers, user: answers.get("1") in ("gradual",) and
                              any(s in answers.get("2", []) for s in ["blur"]),
    14: lambda answers, user: isinstance(answers.get("2"), list) and "pain" in answers.get("2", []),
    15: lambda answers, user: int(user.get("age", 0)) >= 50,
    16: lambda answers, user: answers.get("1") == "fluctuating",
    17: lambda answers, user: answers.get("4") in ("autoimmune", "thyroid"),
    18: lambda answers, user: answers.get("5") in ("yes", "migraine"),
}

DYNAMIC_QUESTIONS_DATA = {
    9: {
        "id": 9,
        "text": "В каком глазу возникла резкая потеря зрения?",
        "type": "single",
        "options": [
            {"value": "right", "label": "В правом"},
            {"value": "left",  "label": "В левом"},
            {"value": "both",  "label": "В обоих сразу"},
            {"value": "unknown", "label": "Затрудняюсь ответить"},
        ]
    },
    10: {
        "id": 10,
        "text": "Мушки или вспышки перед глазами — они нарастали в течение последних часов?",
        "type": "single",
        "options": [
            {"value": "no",    "label": "Нет, стабильны"},
            {"value": "yes",   "label": "Да, стало значительно больше"},
            {"value": "unsure","label": "Не уверен(а)"},
        ]
    },
    11: {
        "id": 11,
        "text": "Ваш сахарный диабет находится под контролем?",
        "type": "single",
        "options": [
            {"value": "controlled",   "label": "Да, регулярно слежу за сахаром"},
            {"value": "uncontrolled", "label": "Нет, уровень часто высокий"},
            {"value": "unknown",      "label": "Не знаю"},
        ]
    },
    12: {
        "id": 12,
        "text": "Используете ли вы капли для снижения внутриглазного давления?",
        "type": "single",
        "options": [
            {"value": "yes",     "label": "Да"},
            {"value": "no",      "label": "Нет"},
            {"value": "unknown", "label": "Не знаю"},
        ]
    },
    13: {
        "id": 13,
        "text": "Расплывчатость зрения — она касается одного глаза или обоих?",
        "type": "single",
        "options": [
            {"value": "unilateral", "label": "Только одного глаза"},
            {"value": "bilateral",  "label": "Обоих глаз"},
        ]
    },
    14: {
        "id": 14,
        "text": "Насколько выражена боль в глазу?",
        "type": "single",
        "options": [
            {"value": "mild",     "label": "Лёгкий дискомфорт"},
            {"value": "moderate", "label": "Умеренная боль"},
            {"value": "severe",   "label": "Сильная, невыносимая боль"},
        ]
    },
    15: {
        "id": 15,
        "text": "Замечаете ли вы ухудшение центрального зрения (прямые линии кажутся изогнутыми, тёмное пятно в центре)?",
        "type": "single",
        "options": [
            {"value": "no",        "label": "Нет"},
            {"value": "yes",       "label": "Да"},
            {"value": "sometimes", "label": "Иногда"},
        ]
    },
    16: {
        "id": 16,
        "text": "Когда зрение меняется в течение дня?",
        "type": "single",
        "options": [
            {"value": "lighting",    "label": "При смене освещения"},
            {"value": "fatigue",     "label": "Ближе к вечеру / при усталости"},
            {"value": "time_of_day", "label": "В определённое время суток"},
            {"value": "unknown",     "label": "Без видимой причины"},
        ]
    },
    17: {
        "id": 17,
        "text": "Есть ли у вас ощущение выпяченности или «выпученности» глаз?",
        "type": "single",
        "options": [
            {"value": "no",    "label": "Нет"},
            {"value": "yes",   "label": "Да, заметно"},
            {"value": "unsure","label": "Не уверен(а)"},
        ]
    },
    18: {
        "id": 18,
        "text": "Перед головной болью возникает ли зрительная аура (зигзаги, мерцание, слепое пятно)?",
        "type": "single",
        "options": [
            {"value": "no",  "label": "Нет"},
            {"value": "yes", "label": "Да"},
        ]
    },
}


def get_active_question_ids(answers: dict, user_data: dict) -> List[int]:
    """Возвращает упорядоченный список id вопросов для текущего пациента."""
    active = list(STATIC_QUESTIONS)
    for qid in sorted(DYNAMIC_QUESTION_CONDITIONS.keys()):
        try:
            if DYNAMIC_QUESTION_CONDITIONS[qid](answers, user_data):
                active.append(qid)
        except Exception:
            pass
    return active

class DiagnosisEngine:
    def __init__(self):
        self.rules: List[Rule] = []
        self._load_rules()

    def _load_rules(self):
        self.rules = [
            Rule("Острая закрытоугольная глаукома — неотложка",
                 {"high_iop": "yes_high", "vision_loss": "sudden"},
                 diagnosis_id=4, score=100, priority=100),

            Rule("Острый приступ глаукомы + боль",
                 {"high_iop": "yes_high", "pain_level": "severe"},
                 diagnosis_id=4, score=95, priority=100),

            Rule("Отслойка сетчатки (нарастающая)",
                 {"vision_loss": "sudden", "floaters_progressing": "yes"},
                 diagnosis_id=7, score=95, priority=98),

            Rule("Отслойка сетчатки / Острая неврология",
                 {"vision_loss": "sudden", "symptoms": ["flashes", "floaters"]},
                 diagnosis_id=7, score=90, priority=95),

            Rule("Тромбоз / Ишемия сетчатки",
                 {"vision_loss": "sudden", "history": "hypertension"},
                 diagnosis_id=7, score=88, priority=94),

            Rule("Внезапная потеря зрения — неотложка",
                 {"vision_loss": "sudden"},
                 diagnosis_id=7, score=85, priority=90),

            Rule("Тяжёлый болевой синдром в глазу (неуточнённый)",
                 {"pain_level": "severe"},
                 diagnosis_id=17, score=80, priority=88),

            Rule("Диабетическая ретинопатия (некомпенсированная)",
                 {"history": "diabetes", "diabetes_control": "uncontrolled"},
                 diagnosis_id=2, score=90, priority=85),

            Rule("Диабетическая ретинопатия",
                 {"history": "diabetes"},
                 diagnosis_id=2, score=75, priority=75),

            Rule("Возрастная макулярная дегенерация (симптом искажения)",
                 {"age": lambda a: a >= 55, "central_vision_loss": "yes"},
                 diagnosis_id=6, score=88, priority=82),

            Rule("Глаукома (высокий риск — семейный анамнез + возраст)",
                 {"family_history": "yes", "age": lambda a: a >= 45},
                 diagnosis_id=8, score=80, priority=78),

            Rule("Глаукома (повышенное ВГД + семейный анамнез)",
                 {"high_iop": "yes_high", "family_history": "yes"},
                 diagnosis_id=8, score=85, priority=80),

            Rule("Мигрень с аурой",
                 {"headache": "migraine", "aura": "yes"},
                 diagnosis_id=1, score=80, priority=75),

            Rule("Мигрень / Зрительные нарушения + головная боль",
                 {"headache": lambda h: h in ("yes", "sometimes", "migraine"),
                  "symptoms": ["floaters", "flashes"]},
                 diagnosis_id=1, score=65, priority=65),

            Rule("Тиреоидная офтальмопатия (экзофтальм)",
                 {"history": "thyroid", "exophthalmos": "yes"},
                 diagnosis_id=10, score=88, priority=80),

            Rule("Аутоиммунный увеит / иридоциклит",
                 {"history": "autoimmune", "symptoms": ["redness", "pain"]},
                 diagnosis_id=11, score=78, priority=72),

            Rule("Катаракта — возрастная",
                 {"age": lambda a: a >= 60, "vision_loss": "gradual"},
                 diagnosis_id=5, score=72, priority=58),

            Rule("Катаракта / Возрастные изменения",
                 {"age": lambda a: a >= 55},
                 diagnosis_id=5, score=50, priority=45),

            Rule("Возрастная макулярная дегенерация",
                 {"age": lambda a: a >= 60},
                 diagnosis_id=6, score=65, priority=55),

            Rule("Синдром сухого глаза — экранная работа",
                 {"work_habits": lambda w: w in ("more_6h", "more_8h"), "symptoms": ["dryness"]},
                 diagnosis_id=3, score=65, priority=48),

            Rule("Синдром сухого глаза — рефлекторное слезотечение",
                 {"work_habits": lambda w: w in ("more_6h", "more_8h"), "symptoms": ["tearing"]},
                 diagnosis_id=3, score=55, priority=45),

            Rule("Компьютерный зрительный синдром",
                 {"work_habits": "more_8h", "symptoms": ["blur"], "headache": lambda h: h in ("yes", "sometimes")},
                 diagnosis_id=3, score=60, priority=50),

            Rule("Нарушение рефракции — одностороннее",
                 {"vision_loss": "gradual", "blur_laterality": "unilateral"},
                 diagnosis_id=13, score=55, priority=40),

            Rule("Диплопия / Парез глазодвигательных мышц",
                 {"symptoms": ["double_vision"]},
                 diagnosis_id=12, score=60, priority=50),

            Rule("Конъюнктивит / Синдром красного глаза",
                 {"symptoms": ["redness", "tearing"]},
                 diagnosis_id=14, score=50, priority=42),

            Rule("Гипертоническая ретинопатия",
                 {"history": "hypertension", "vision_loss": lambda v: v in ("gradual", "fluctuating")},
                 diagnosis_id=15, score=65, priority=60),

            Rule("Пресбиопия / Возрастная дальнозоркость",
                 {"age": lambda a: 45 <= a <= 65, "vision_loss": "gradual", "work_habits": lambda w: w in ("more_6h", "more_8h")},
                 diagnosis_id=13, score=55, priority=38),

            Rule("Глаукома — редкая проверка ВГД",
                 {"last_check": lambda l: l in ("never", "more_3y"), "age": lambda a: a >= 40},
                 diagnosis_id=8, score=45, priority=35),

            Rule("Флюктуирующее зрение при усталости (Астенопия)",
                 {"vision_loss": "fluctuating", "fluctuation_trigger": "fatigue"},
                 diagnosis_id=16, score=45, priority=32),

            Rule("Галоэффект — возможная ранняя катаракта",
                 {"symptoms": ["halos"]},
                 diagnosis_id=5, score=50, priority=40),
        ]

        self.rules.sort(key=attrgetter('priority'), reverse=True)

    def _fact_matches_rule(self, fact: Fact, rule: Rule) -> bool:
        for key, condition in rule.conditions.items():
            value = getattr(fact, key, None)
            if value is None:
                return False
            if callable(condition):
                if not condition(value):
                    return False
            elif isinstance(condition, list):
                if isinstance(value, list):
                    if not any(item in value for item in condition):
                        return False
                elif value not in condition:
                    return False
            else:
                if value != condition:
                    return False
        return True

    def _build_fact(self, answers: dict, user_data: dict) -> Fact:
        """Собирает объект Fact из словарей ответов и данных пациента."""
        q_map = {
            1:  'vision_loss',
            2:  'symptoms',
            3:  'work_habits',
            4:  'history',
            5:  'headache',
            6:  'high_iop',
            7:  'family_history',
            8:  'last_check',
            9:  'affected_eye',
            10: 'floaters_progressing',
            11: 'diabetes_control',
            12: 'using_drops',
            13: 'blur_laterality',
            14: 'pain_level',
            15: 'central_vision_loss',
            16: 'fluctuation_trigger',
            17: 'exophthalmos',
            18: 'aura',
        }

        mapped = {}
        for q_id_str, value in answers.items():
            q_id = int(q_id_str)
            field_name = q_map.get(q_id)
            if field_name:
                mapped[field_name] = value

        return Fact(
            age=int(user_data.get('age', 0)),
            gender=user_data.get('gender'),
            vision_loss=mapped.get('vision_loss'),
            symptoms=mapped.get('symptoms') or [],
            work_habits=mapped.get('work_habits'),
            history=mapped.get('history'),
            headache=mapped.get('headache'),
            high_iop=mapped.get('high_iop'),
            family_history=mapped.get('family_history'),
            last_check=mapped.get('last_check'),
            affected_eye=mapped.get('affected_eye'),
            floaters_progressing=mapped.get('floaters_progressing'),
            diabetes_control=mapped.get('diabetes_control'),
            using_drops=mapped.get('using_drops'),
            blur_laterality=mapped.get('blur_laterality'),
            pain_level=mapped.get('pain_level'),
            central_vision_loss=mapped.get('central_vision_loss'),
            fluctuation_trigger=mapped.get('fluctuation_trigger'),
            exophthalmos=mapped.get('exophthalmos'),
            aura=mapped.get('aura'),
        )

    def diagnose(self, answers: dict, user_data: dict = None) -> dict:
        if user_data is None:
            user_data = {}

        fact = self._build_fact(answers, user_data)

        conn = get_main_db()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id, name, description, urgency FROM diagnosis")
                diagnoses_db = {row['id']: row for row in cur.fetchall()}
        finally:
            conn.close()

        if not diagnoses_db:
            return {
                "id": 9,
                "diagnosis": "Рекомендуется плановый осмотр",
                "urgency": "low",
                "diagnoses": [],
            }

        diagnosis_scores = defaultdict(
            lambda: {"total_score": 0, "max_priority": 0, "rules": []}
        )

        for rule in self.rules:
            if self._fact_matches_rule(fact, rule):
                d = diagnosis_scores[rule.diagnosis_id]
                d["total_score"] += rule.score
                d["max_priority"] = max(d["max_priority"], rule.priority)
                d["rules"].append(rule.name)

        for d in diagnosis_scores.values():
            d["total_score"] = min(d["total_score"], 150)

        result_diagnoses = []
        for diag_id, data in diagnosis_scores.items():
            db_info = diagnoses_db.get(diag_id, {})
            result_diagnoses.append({
                "id": diag_id,
                "diagnosis": db_info.get('description', f'Диагноз {diag_id}'),
                "urgency": db_info.get('urgency', 'medium'),
                "score": data["total_score"],
                "priority": data["max_priority"],
                "rules": data["rules"],
            })

        result_diagnoses.sort(
            key=lambda x: (x["priority"], x["score"]),
            reverse=True,
        )

        if not result_diagnoses or result_diagnoses[0]["priority"] < 30:
            default = diagnoses_db.get(9, {})
            main_diagnosis = {
                "id": 9,
                "diagnosis": default.get('description', "Рекомендуется плановый осмотр"),
                "urgency": default.get('urgency', 'low'),
            }
            extra_diagnoses = []
        else:
            main_diagnosis = result_diagnoses[0]
            extra_diagnoses = result_diagnoses[1:6]

        final_result = {
            "id": main_diagnosis["id"],
            "diagnosis": main_diagnosis["diagnosis"],
            "urgency": main_diagnosis["urgency"],
            "diagnoses": [main_diagnosis] + extra_diagnoses,
        }

        print(f"\n=== ДИАГНОЗ [{fact.age} л., {fact.gender}] ===")
        print(f"Сработало правил: {sum(len(d['rules']) for d in result_diagnoses)}")
        print("-" * 70)
        for i, d in enumerate(result_diagnoses[:6], 1):
            flag = "⚠" if d["urgency"] == "high" else " "
            print(f"{flag}{i:2}. [{d['priority']:3}] {d['diagnosis']:<48} {d['score']:3} б.")
        print("=" * 70)

        return final_result


engine = DiagnosisEngine()


def get_diagnosis(answers: dict, user_data: dict = None) -> dict:
    return engine.diagnose(answers, user_data)
