# Linux only: the container needs the Arduino's USB port passed in (see docker-compose.yml). Docker Desktop on
# Mac/Windows can't do that, so there run `npm start` (or `python rihab_server.py`) on the laptop instead.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py .
EXPOSE 8000
CMD ["python", "rihab_server.py", "--port", "/dev/ttyACM0", "--host", "0.0.0.0"]
