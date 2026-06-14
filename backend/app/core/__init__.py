"""
Core functionality: configuration, database, security
"""

from .config import (
    JWT_SECRET,
    JWT_ALGO,
    JWT_EXPIRE_MINUTES,
    MAIN_DB,
    AUTH_DB,
    LOGIN_PATTERN,
    PASSWORD_PATTERN
)

from .database import get_main_db, get_auth_db
from .security import (
    security,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin
)

__all__ = [
    "JWT_SECRET",
    "JWT_ALGO",
    "MAIN_DB",
    "AUTH_DB",
    "get_main_db",
    "get_auth_db",
    "security",
    "verify_password",
    "create_access_token",
    "get_current_user",
    "require_admin",
]