"""
Expert System API
Офтальмическая экспертная система
"""

__version__ = "1.0.0"

from .routers import auth, admin, diagnosis

__all__ = ["auth", "admin", "diagnosis"]