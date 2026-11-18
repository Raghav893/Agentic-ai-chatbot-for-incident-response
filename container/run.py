import signal
import subprocess
import threading
import time


def main():
    stopping = threading.Event()
    for signum in (signal.SIGTERM, signal.SIGINT):
        signal.signal(signum, lambda *_: stopping.set())

    postgres = subprocess.Popen([
        "docker-entrypoint.sh", "postgres", "-c", "listen_addresses=127.0.0.1",
    ])
    apps = {}
    try:
        deadline = time.monotonic() + 60
        while not stopping.is_set():
            if postgres.poll() is not None:
                raise RuntimeError("PostgreSQL exited during startup.")
            if subprocess.run(["pg_isready", "-q", "-h", "127.0.0.1"]).returncode == 0:
                break
            if time.monotonic() >= deadline:
                raise RuntimeError("PostgreSQL did not become ready.")
            stopping.wait(0.5)

        if stopping.is_set():
            return
        apps["FastAPI"] = subprocess.Popen([
            "/app/.venv/bin/python", "-m", "uvicorn", "app.main:app",
            "--host", "0.0.0.0", "--port", "8000",
        ])
        apps["Spring Boot"] = subprocess.Popen(["java", "-jar", "/app/backend.jar"])

        while not stopping.wait(0.5):
            for name, process in {"PostgreSQL": postgres, **apps}.items():
                code = process.poll()
                if code is not None:
                    raise RuntimeError(f"{name} exited unexpectedly with status {code}.")
    finally:
        for process in apps.values():
            if process.poll() is None:
                process.terminate()
        for process in apps.values():
            wait_for_exit(process, 6)
        if postgres.poll() is None:
            postgres.send_signal(signal.SIGINT)
        wait_for_exit(postgres, 10)


def wait_for_exit(process, timeout):
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()


if __name__ == "__main__":
    main()
