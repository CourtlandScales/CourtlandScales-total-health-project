# Runs the server with the simulator. Docker Desktop on Mac/Windows can't pass the Arduino's USB
# port into a container, so for real hardware run `python rihab_server.py` on the laptop instead.
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py .
EXPOSE 8000
CMD ["python", "rihab_server.py", "--sim", "--host", "0.0.0.0"]
