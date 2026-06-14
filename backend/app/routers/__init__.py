"""
API routers
"""

from .auth import router as auth_router
from .admin import router as admin_router
from .diagnosis import router as diagnosis_router

__all__ = ["auth_router", "admin_router", "diagnosis_router"]