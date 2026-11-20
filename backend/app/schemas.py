from pydantic import BaseModel, Field, ConfigDict
from typing import Literal

class LoginInput(BaseModel):
    email: str
    password: str

class ApplicationInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    monthly_income: int = Field(ge=0, le=10_000_000)
    household_members: int = Field(ge=1, le=50)
    province: Literal["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"]
    notes: str = Field(default="", max_length=1500)
    model_config = ConfigDict(extra="forbid")

class StatusInput(BaseModel):
    status: Literal["UNDER_REVIEW", "NEEDS_DOCUMENTS", "REVIEW_COMPLETE"]
    reason: str = Field(min_length=5, max_length=500)
