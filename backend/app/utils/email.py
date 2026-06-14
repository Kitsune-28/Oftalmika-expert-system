import base64
from datetime import datetime
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

import aiosmtplib
from fastapi import HTTPException

from app.schemas.user import SendPDFEmailRequest
from dotenv import load_dotenv
import os

load_dotenv(override=True)


async def send_pdf_email(request: SendPDFEmailRequest):
    try:
        pdf_bytes = base64.b64decode(request.pdf_base64)
        from_email = os.getenv("SMTP_FROM")
        if not from_email:
            raise Exception("SMTP_FROM не найден в .env")

        gender = request.gender.lower() if request.gender else "male"
        appeal = "Уважаемая " if gender in ["female", "f", "женский"] else "Уважаемый "

        subject = f"Результаты анализа зрения — {request.patient_name}"

        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = request.email
        msg['Subject'] = subject

        body = f"""{appeal}{request.patient_name}!

Во вложении находится PDF с результатами вашего предварительного анализа зрения.
Рекомендуется обратиться к врачу-офтальмологу для точной диагностики.

Данное письмо создано автоматически, отвечать на него не нужно.

С уважением,
Офтальмика"""

        msg.attach(MIMEText(body, 'plain', 'utf-8'))

        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition', 'attachment',
                        filename=f"Диагноз_{request.patient_name.replace(' ', '_')}_{datetime.now().strftime('%Y-%m-%d')}.pdf")
        msg.attach(part)

        tls_context = ssl.create_default_context()
        tls_context.check_hostname = False
        tls_context.verify_mode = ssl.CERT_NONE

        await aiosmtplib.send(
            msg,
            hostname=os.getenv("SMTP_HOST", "smtp.yandex.ru"),
            port=int(os.getenv("SMTP_PORT", 587)),
            username=os.getenv("SMTP_USER"),
            password=os.getenv("SMTP_PASSWORD"),
            use_tls=False,
            start_tls=True,
            tls_context=tls_context,
            timeout=30
        )

        return {"status": "success", "message": "Письмо успешно отправлено"}

    except Exception as e:
        print(f"Ошибка отправки email: {e}")
        raise HTTPException(status_code=500, detail="Не удалось отправить письмо")