FROM python:3.12-slim

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --gid 1001 appuser

# Install dependencies
COPY apps/ai-service/requirements.txt .
# Force pip to download the CPU-only version of PyTorch (saves ~3GB of NVIDIA CUDA drivers)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code with correct ownership
COPY --chown=appuser:appgroup apps/ai-service .

USER appuser
EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV HF_HOME=/tmp/huggingface

# Use gunicorn with uvicorn workers for production
CMD ["gunicorn", "app.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
