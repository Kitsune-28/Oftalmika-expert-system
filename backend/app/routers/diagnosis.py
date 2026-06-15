import json
import re
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from psycopg2.extras import RealDictCursor

from app.core.database import get_main_db
from app.core.security import get_current_user
from app.services.diagnosis_service import get_diagnosis, get_active_question_ids, DYNAMIC_QUESTIONS_DATA
from app.schemas.user import SendPDFEmailRequest
from app.utils.email import send_pdf_email

router = APIRouter(tags=["diagnosis"])

def _parse_options(raw) -> list:
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return []
    return raw or []


def _row_to_question(row: dict) -> dict:
    return {
        "id": row["id"],
        "text": row["questiontext"],
        "type": row["questiontype"],
        "options": _parse_options(row["questionoptions"]),
        "dynamic": False,
    }

@router.post("/api/questions")
async def get_questions():
    conn = None
    try:
        conn = get_main_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, questiontext, questiontype, questionoptions
                FROM question
                WHERE id BETWEEN 1 AND 8
                ORDER BY id ASC
            """)
            rows = cur.fetchall()
            return [_row_to_question(r) for r in rows]
    finally:
        if conn:
            conn.close()

@router.post("/api/questions/dynamic")
async def get_dynamic_questions(payload: Dict[str, Any]):
    """
    Принимает текущие ответы и данные пациента,
    возвращает список динамических вопросов, которые нужно показать.
    Каждый вопрос помечен dynamic: true.
    """
    answers = payload.get("answers", {})
    user = payload.get("user", {})

    active_ids = get_active_question_ids(answers, user)
    dynamic_ids = [qid for qid in active_ids if qid > 8]

    questions = []
    for qid in dynamic_ids:
        q = DYNAMIC_QUESTIONS_DATA.get(qid)
        if q:
            questions.append({**q, "dynamic": True})

    return {"questions": questions, "active_ids": active_ids}

@router.post("/api/analyze")
async def analyze_answers(payload: Dict[str, Any]):
    try:
        answers = payload.get("answers", {})
        user = payload.get("user")

        if not user:
            raise HTTPException(status_code=400, detail="Не переданы данные пациента")

        age = user.get("age")
        if age is None or int(age) < 1 or int(age) > 120:
            raise HTTPException(status_code=400, detail="Возраст должен быть от 1 до 120 лет")

        first_name = user.get("firstName", "")
        last_name = user.get("lastName", "")
        if re.search(r'\d', first_name) or re.search(r'\d', last_name):
            raise HTTPException(status_code=400, detail="Имя и фамилия не должны содержать цифры")

        result = get_diagnosis(answers, user_data=user)

        conn = None
        try:
            conn = get_main_db()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO session_ (firstname, lastname, gender, age, diagnosisid, sessiontime)
                    VALUES (%s, %s, %s, %s, %s, NOW()) RETURNING id
                    """,
                    (
                        user["firstName"], user["lastName"],
                        user["gender"], user["age"], result["id"],
                    ),
                )
                session_id = cur.fetchone()[0]

                for q_id, ans in answers.items():
                    if isinstance(ans, list):
                        ans = ",".join(map(str, ans))
                    cur.execute(
                        "INSERT INTO answer (questionid, sessionid, answer) VALUES (%s, %s, %s)",
                        (q_id, session_id, ans),
                    )
                conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            print(f"Ошибка сохранения сессии: {e}")
        finally:
            if conn:
                conn.close()

        return result

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Ошибка при анализе данных")


@router.post("/api/sessions")
async def get_all_sessions(current_user: dict = Depends(get_current_user)):
    conn = None
    try:
        conn = get_main_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT s.id, s.firstname, s.lastname, s.gender, s.age, s.sessiontime,
                       d.description AS diagnosis, d.urgency
                FROM session_ s
                JOIN diagnosis d ON s.diagnosisid = d.id
                ORDER BY s.sessiontime DESC
            """)
            sessions = cur.fetchall()

            result = []
            for s in sessions:
                cur.execute("""
                    SELECT a.questionid, q.questiontext, a.answer
                    FROM answer a
                    LEFT JOIN question q ON a.questionid = q.id
                    WHERE a.sessionid = %s
                    ORDER BY a.questionid ASC
                """, (s["id"],))
                ans = cur.fetchall()

                result.append({
                    "id": s["id"],
                    "firstName": s["firstname"],
                    "lastName": s["lastname"],
                    "gender": s["gender"],
                    "age": s["age"],
                    "diagnosis": s["diagnosis"],
                    "urgency": s["urgency"],
                    "sessiontime": s["sessiontime"].strftime("%d.%m.%Y %H:%M") if s["sessiontime"] else "",
                    "answers": [
                        {
                            "questionId": a["questionid"],
                            "questionText": a["questiontext"] or f"Вопрос {a['questionid']}",
                            "answer": a["answer"],
                        }
                        for a in ans
                    ],
                })
            return result
    finally:
        if conn:
            conn.close()

@router.post("/api/sessions/stats")
async def get_sessions_stats(current_user: dict = Depends(get_current_user)):
    conn = None
    try:
        conn = get_main_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) AS total FROM session_")
            total = cur.fetchone()["total"]

            cur.execute("""
                SELECT d.urgency, COUNT(*) AS count
                FROM session_ s
                JOIN diagnosis d ON s.diagnosisid = d.id
                GROUP BY d.urgency
            """)
            stats = cur.fetchall()

            return {
                "total": total,
                "urgency": {i["urgency"]: i["count"] for i in stats},
            }
    finally:
        if conn:
            conn.close()

@router.post("/api/send-pdf-email")
async def send_email_endpoint(request: SendPDFEmailRequest):
    return await send_pdf_email(request)
