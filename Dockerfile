FROM maven:3.9-eclipse-temurin-21 AS backend-build
WORKDIR /build
COPY backend/pom.xml .
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp package

FROM postgres:17-trixie AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl openjdk-21-jre-headless python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY ai-service/requirements.txt ./requirements.txt
RUN python3 -m venv .venv && .venv/bin/pip install --no-cache-dir -r requirements.txt

FROM runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY ai-service/app ./app
COPY container/run.py ./run.py
COPY --from=backend-build /build/target/threatguard-backend-0.1.0.jar ./backend.jar
EXPOSE 8080 8000
STOPSIGNAL SIGTERM
ENTRYPOINT ["python3", "/app/run.py"]
CMD []
