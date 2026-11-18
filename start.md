# Start ThreatGuard

Start Docker Desktop, then run this from the project root in PowerShell.

```powershell
docker compose up --wait
```

Open [ThreatGuard](http://127.0.0.1:8080/) once the container is healthy.

Use this command to rebuild after changing the source code.

```powershell
docker compose up --build --wait
```

Docker Compose loads `DEEPSEEK_API_KEY` and the optional `VIRUSTOTAL_API_KEY` from `.env`. On a new checkout, copy `.env.example` to `.env` and fill in your keys before starting.

To stop the app and keep your saved chats, run `docker compose stop`.
