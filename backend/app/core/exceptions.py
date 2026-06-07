from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


class NotFoundError(AppError):
    def __init__(self, detail: str = "Not found"):
        super().__init__(404, detail)


class ConflictError(AppError):
    def __init__(self, detail: str = "Conflict"):
        super().__init__(409, detail)


class ForbiddenError(AppError):
    def __init__(self, detail: str = "Permission denied"):
        super().__init__(403, detail)


class UnauthorizedError(AppError):
    def __init__(self, detail: str = "Unauthorized"):
        super().__init__(401, detail)


class ValidationError(AppError):
    def __init__(self, detail: str = "Validation error"):
        super().__init__(400, detail)


class ServiceUnavailableError(AppError):
    def __init__(self, detail: str = "AI service temporarily unavailable"):
        super().__init__(503, detail)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
