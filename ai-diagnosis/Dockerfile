# Lightweight Python base
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy all application code first
COPY . /app

# Now, install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose FastAPI's default port
EXPOSE 8000

# Start the FastAPI server with uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
