# Lightweight Python base
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy dependency list first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Expose FastAPI's default port
EXPOSE 8000

# Start the FastAPI server with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
