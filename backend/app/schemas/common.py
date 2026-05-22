from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error: dict
