# Production Dockerfile for Railway deployment
FROM python:3.11-slim

# Prevent Python from writing .pyc files & enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install system dependencies (FFmpeg, ImageMagick, TrueType fonts, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    fonts-freefont-ttf \
    fonts-dejavu-core \
    fonts-liberation \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Fix ImageMagick security policy for MoviePy TextClip rendering
RUN if [ -f /etc/ImageMagick-6/policy.xml ]; then \
      sed -i 's/<policy domain="path" rights="none" pattern="@\*"\/>/<policy domain="path" rights="read|write" pattern="@*"\/>/g' /etc/ImageMagick-6/policy.xml ; \
    fi

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code and assets
COPY src/ ./src/
COPY themes/ ./themes/
COPY assets/ ./assets/
COPY input/ ./input/

# Ensure all runtime media storage directories exist
RUN mkdir -p /app/input/audio /app/input/lyrics /app/input/backgrounds /app/output

EXPOSE ${PORT}

# Launch FastAPI via uvicorn binding to Railway's assigned $PORT
CMD ["sh", "-c", "uvicorn src.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
