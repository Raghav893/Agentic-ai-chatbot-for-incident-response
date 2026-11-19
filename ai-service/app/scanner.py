import asyncio
import hashlib
import struct

from fastapi import HTTPException, Request

from .schemas import FileScanResponse


MAX_FILE_SIZE = 20 * 1024 * 1024
CHUNK_SIZE = 64 * 1024
UPLOAD_TIMEOUT = 15
CONNECTION_TIMEOUT = 3
SCAN_TIMEOUT = 15


class FileScanner:
    def __init__(self, host: str, port: int) -> None:
        self.host = host
        self.port = port
        self.slots = asyncio.Semaphore(4)

    async def scan(self, request: Request) -> FileScanResponse:
        content_type = request.headers.get("content-type", "").partition(";")[0].strip().lower()
        if content_type != "application/octet-stream":
            raise HTTPException(415, "Send the file as application/octet-stream.")

        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                declared_size = int(content_length)
            except ValueError as error:
                raise HTTPException(400, "Invalid Content-Length.") from error
            if declared_size < 0:
                raise HTTPException(400, "Invalid Content-Length.")
            if declared_size > MAX_FILE_SIZE:
                raise HTTPException(413, "Files must be 20 MiB or smaller.")

        if self.slots.locked():
            return FileScanResponse(status="scan_incomplete", detail="The file scanner is busy. Try again shortly.")

        async with self.slots:
            try:
                async with asyncio.timeout(UPLOAD_TIMEOUT):
                    data = await read_file(request)
            except TimeoutError as error:
                raise HTTPException(408, "The file upload timed out.") from error

            sha256 = hashlib.sha256(data).hexdigest()
            try:
                async with asyncio.timeout(SCAN_TIMEOUT):
                    reply = await self._scan_stream(data)
            except TimeoutError:
                return FileScanResponse(status="scan_incomplete", sha256=sha256, detail="The file scan timed out.")
            except (OSError, asyncio.IncompleteReadError, asyncio.LimitOverrunError, UnicodeError):
                return FileScanResponse(
                    status="scan_incomplete", sha256=sha256, detail="The local file scanner is unavailable."
                )

        return scan_result(reply, sha256)

    async def _scan_stream(self, data: bytearray) -> str:
        async with asyncio.timeout(CONNECTION_TIMEOUT):
            reader, writer = await asyncio.open_connection(self.host, self.port, limit=4096)

        try:
            writer.write(b"zINSTREAM\0")
            view = memoryview(data)
            for offset in range(0, len(view), CHUNK_SIZE):
                chunk = view[offset : offset + CHUNK_SIZE]
                writer.write(struct.pack("!I", len(chunk)))
                writer.write(chunk)
                await writer.drain()
            writer.write(b"\0\0\0\0")
            await writer.drain()
            return (await reader.readuntil(b"\0"))[:-1].decode("ascii")
        finally:
            writer.transport.abort()


async def read_file(request: Request) -> bytearray:
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > MAX_FILE_SIZE:
            raise HTTPException(413, "Files must be 20 MiB or smaller.")
        data.extend(chunk)
    if not data:
        raise HTTPException(400, "Choose a non-empty file.")
    return data


def scan_result(reply: str, sha256: str) -> FileScanResponse:
    if reply == "stream: OK":
        return FileScanResponse(status="no_threats_detected", sha256=sha256)

    if reply.startswith("stream: ") and reply.endswith(" FOUND"):
        signature = reply.removeprefix("stream: ").removesuffix(" FOUND")
        if signature.startswith("Heuristics.Encrypted."):
            detail = "The scanner could not inspect encrypted content."
        elif signature.startswith("Heuristics.Limits.Exceeded"):
            detail = "The file exceeded the scanner's inspection limits."
        elif signature.isprintable():
            return FileScanResponse(status="threat_detected", sha256=sha256, signature=signature)
        else:
            detail = "The scanner returned an invalid detection result."
    elif "size limit exceeded" in reply.lower():
        detail = "The file exceeded the scanner's inspection limits."
    else:
        detail = "The local scanner could not complete the scan."

    return FileScanResponse(status="scan_incomplete", sha256=sha256, detail=detail)
