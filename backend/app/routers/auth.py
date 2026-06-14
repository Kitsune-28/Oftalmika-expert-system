from fastapi import APIRouter, HTTPException
from psycopg2.extras import RealDictCursor

from app.core.database import get_auth_db
from app.core.security import verify_password, create_access_token
from app.schemas.user import LoginRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(req: LoginRequest):
    conn = None
    try:
        conn = get_auth_db()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, login, password_hash, role FROM users WHERE login = %s AND is_active = TRUE",
                (req.login,)
            )
            user = cur.fetchone()

            if not user:
                raise HTTPException(status_code=401, detail="Неверный логин или пароль")

            if not verify_password(req.password, user['password_hash']):
                raise HTTPException(status_code=401, detail="Неверный логин или пароль")

            token = create_access_token({
                "sub": str(user['id']),
                "login": user['login'],
                "role": user.get('role', 'doctor')
            })

            return {
                "access_token": token,
                "token_type": "bearer",
                "role": user.get('role', 'doctor')
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Ошибка авторизации: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")
    finally:
        if conn:
            conn.close()