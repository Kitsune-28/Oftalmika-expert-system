import psycopg2
from psycopg2.extras import RealDictCursor
from app.core.config import MAIN_DB, AUTH_DB


def get_main_db():
    return psycopg2.connect(**MAIN_DB)


def get_auth_db():
    return psycopg2.connect(**AUTH_DB)