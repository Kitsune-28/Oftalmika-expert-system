import os
import re
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_THIS_SECRET_IN_PRODUCTION")
JWT_ALGO = "HS256"
JWT_EXPIRE_MINUTES = 60

MAIN_DB = {
    "host": os.getenv("MAIN_DB_HOST", "localhost"),
    "database": os.getenv("MAIN_DB_NAME", "expertSystemDatabase"),
    "user": os.getenv("MAIN_DB_USER", "postgres"),
    "password": os.getenv("MAIN_DB_PASS", "272817"),
    "port": os.getenv("MAIN_DB_PORT", "5432")
}

AUTH_DB = {
    "host": os.getenv("AUTH_DB_HOST", "localhost"),
    "database": os.getenv("AUTH_DB_NAME", "expertSystemAuthorization"),
    "user": os.getenv("AUTH_DB_USER", "postgres"),
    "password": os.getenv("AUTH_DB_PASS", "272817"),
    "port": os.getenv("AUTH_DB_PORT", "5432")
}

LOGIN_PATTERN = re.compile(r'^[a-zA-Z0-9]+$')

PASSWORD_PATTERN = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?`~])'
    r'[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};\'":\\|,.<>\/?`~]{8,}$'
)
