from fastapi import APIRouter, HTTPException, Depends
import re
import bcrypt
from psycopg2.extras import RealDictCursor

from app.core.database import get_main_db, get_auth_db
from app.core.config import LOGIN_PATTERN, PASSWORD_PATTERN   # ← важно!
from app.core.security import require_admin
from app.schemas.user import UserUpdate, UserCreate, SessionUpdate

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/sessions")
async def admin_get_sessions(admin: dict = Depends(require_admin)):
    conn = None
    try:
        conn = get_main_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT s.id, s.firstname, s.lastname, s.gender, s.age, s.sessiontime,
                       d.description as diagnosis, d.urgency
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
                    JOIN question q ON a.questionid = q.id
                    WHERE a.sessionid = %s 
                    ORDER BY a.questionid ASC
                """, (s['id'],))
                ans = cur.fetchall()

                result.append({
                    "id": s['id'],
                    "firstName": s['firstname'],
                    "lastName": s['lastname'],
                    "gender": s['gender'],
                    "age": s['age'],
                    "diagnosis": s['diagnosis'],
                    "urgency": s['urgency'],
                    "sessiontime": s['sessiontime'].strftime('%d.%m.%Y %H:%M') if s['sessiontime'] else '',
                    "answers": [
                        {"questionId": a['questionid'], "questionText": a['questiontext'], "answer": a['answer']}
                        for a in ans
                    ]
                })
            return result
    finally:
        if conn:
            conn.close()


@router.put("/sessions/{session_id}")
async def update_session(session_id: int, payload: SessionUpdate, admin: dict = Depends(require_admin)):
    conn = None
    try:
        conn = get_main_db()
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE session_ 
                SET firstname=%s, lastname=%s, gender=%s, age=%s, diagnosisid=%s
                WHERE id=%s
            """, (payload.firstName, payload.lastName, payload.gender, payload.age, payload.diagnosisId, session_id))
            conn.commit()
            return {"status": "success", "message": "Сессия обновлена"}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, admin: dict = Depends(require_admin)):
    conn = None
    try:
        conn = get_main_db()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM answer WHERE sessionid = %s", (session_id,))
            cur.execute("DELETE FROM session_ WHERE id = %s", (session_id,))
            conn.commit()
            return {"status": "success", "message": "Сессия удалена"}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


@router.get("/users")
async def admin_get_users(admin: dict = Depends(require_admin)):
    conn = None
    try:
        conn = get_auth_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, login, role, is_active FROM users ORDER BY id ASC")
            return cur.fetchall()
    finally:
        if conn:
            conn.close()


@router.put("/users/{user_id}")
async def update_user(user_id: int, payload: UserUpdate, admin: dict = Depends(require_admin)):
    conn = None
    try:
        if payload.login and not LOGIN_PATTERN.match(payload.login):
            raise HTTPException(status_code=400, detail="Логин должен содержать только английские буквы и цифры")

        if payload.password and str(payload.password).strip():
            if not PASSWORD_PATTERN.match(str(payload.password)):
                raise HTTPException(
                    status_code=400, 
                    detail="Пароль: минимум 8 символов, заглавная + строчная буква, спецсимвол"
                )

        conn = get_auth_db()
        with conn.cursor() as cur:
            if payload.password and str(payload.password).strip():
                import bcrypt
                hashed = bcrypt.hashpw(
                    str(payload.password).encode('utf-8'), 
                    bcrypt.gensalt()
                ).decode('utf-8')

                cur.execute("""
                    UPDATE users 
                    SET login = %s,
                        role = %s,
                        is_active = %s,
                        password_hash = %s
                    WHERE id = %s
                """, (
                    payload.login, 
                    payload.role, 
                    payload.is_active, 
                    hashed, 
                    user_id
                ))
            else:
                cur.execute("""
                    UPDATE users 
                    SET login = %s,
                        role = %s,
                        is_active = %s
                    WHERE id = %s
                """, (
                    payload.login, 
                    payload.role, 
                    payload.is_active, 
                    user_id
                ))

            conn.commit()
            return {"status": "success", "message": "Пользователь успешно обновлён"}

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        import traceback
        traceback.print_exc()
        print(f"Ошибка обновления пользователя: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сервера: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("/users")
async def create_user(payload: UserCreate, admin: dict = Depends(require_admin)):
    if not re.match(r'^[a-zA-Z0-9]+$', payload.login):
        raise HTTPException(status_code=400, detail="Неверный формат логина")

    conn = None
    try:
        conn = get_auth_db()
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE login = %s", (payload.login,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

            import bcrypt
            hashed = bcrypt.hashpw(payload.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cur.execute(
                "INSERT INTO users (login, password_hash, role, is_active) VALUES (%s, %s, %s, %s)",
                (payload.login, hashed, payload.role, payload.is_active)
            )
            conn.commit()
            return {"status": "success", "message": "Пользователь успешно создан"}
    finally:
        if conn:
            conn.close()


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, admin: dict = Depends(require_admin)):
    conn = None
    try:
        conn = get_auth_db()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            conn.commit()
            return {"status": "success", "message": "Пользователь удалён"}
    finally:
        if conn:
            conn.close()