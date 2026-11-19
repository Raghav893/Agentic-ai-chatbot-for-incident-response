# Start ThreatGuard

Start Docker Desktop, then build and start ThreatGuard from the project root in PowerShell.

```powershell
docker compose up --build --wait
```

Open [ThreatGuard](http://127.0.0.1:8080/) once the services are healthy.

To start an existing build, run this command.

```powershell
docker compose up --wait
```

Docker Compose loads `DEEPSEEK_API_KEY` and the optional `VIRUSTOTAL_API_KEY` from `.env`. On a new checkout, copy `.env.example` to `.env` and fill in your keys before starting.

To stop the app and keep your saved chats, run `docker compose stop`.
