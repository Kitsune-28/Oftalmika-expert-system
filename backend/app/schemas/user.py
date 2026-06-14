from pydantic import BaseModel, EmailStr
from typing import Optional


class LoginRequest(BaseModel):
    login: str
    password: str


class UserCreate(BaseModel):
    login: str
    password: str
    role: str = "doctor"
    is_active: bool = True


class UserUpdate(BaseModel):
    login: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class SessionUpdate(BaseModel):
    firstName: str
    lastName: str
    gender: str
    age: int
    diagnosisId: int


class SendPDFEmailRequest(BaseModel):
    email: EmailStr
    pdf_base64: str
    patient_name: str
    gender: str = "male"