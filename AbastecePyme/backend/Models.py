"""Strict public request contracts."""
import re
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class ElementCreate(StrictModel):
    ElementId: str = Field(pattern=r"^[A-Z][A-Z0-9_-]{1,39}$")
    Name: str = Field(min_length=2,max_length=80)
    ElementType: Literal["Supplier","Material","Product"]
    Description: str = Field(default="",max_length=1000)
    Contact: str = Field(default="",max_length=160)
    UnitCode: str = Field(default="unidad",min_length=1,max_length=30)

    @field_validator("Name","UnitCode",mode="before")
    @classmethod
    def CleanText(cls, Value):
        Value = Value.strip() if isinstance(Value,str) else Value
        if not Value:
            raise ValueError("Campo vacío.")
        return Value

class ElementEdit(StrictModel):
    Version: int = Field(ge=1,strict=True)
    Name: str | None = Field(default=None,min_length=2,max_length=80)
    Description: str | None = Field(default=None,max_length=1000)
    Contact: str | None = Field(default=None,max_length=160)
    UnitCode: str | None = Field(default=None,min_length=1,max_length=30)

    @field_validator("Name","UnitCode",mode="before")
    @classmethod
    def CleanText(cls, Value):
        if isinstance(Value,str) and not Value.strip():
            raise ValueError("Campo vacío.")
        return Value.strip() if isinstance(Value,str) else Value

class RelationCreate(StrictModel):
    SourceId: str = Field(pattern=r"^[A-Z][A-Z0-9_-]{1,39}$")
    TargetId: str = Field(pattern=r"^[A-Z][A-Z0-9_-]{1,39}$")
    Value: str | None = Field(default=None,max_length=40)
    IsDemo: bool = Field(default=False,strict=True)

class RelationEdit(RelationCreate):
    Version: int = Field(ge=1,strict=True)

class LoginBody(StrictModel):
    Username: str = Field(min_length=1,max_length=40)
    Password: str = Field(min_length=1,max_length=128)

class Registration(StrictModel):
    Username: str = Field(pattern=r"^[A-Za-z0-9_-]{3,40}$")
    DisplayName: str = Field(min_length=2,max_length=80)
    Password: str = Field(min_length=12,max_length=128)

    @field_validator("DisplayName",mode="before")
    @classmethod
    def CleanName(cls, Value):
        return Value.strip() if isinstance(Value,str) else Value

class AccountEdit(StrictModel):
    DisplayName: str = Field(min_length=2,max_length=80)
    Email: str = Field(default="",max_length=254)

    @field_validator("DisplayName","Email",mode="before")
    @classmethod
    def CleanText(cls, Value):
        return Value.strip() if isinstance(Value,str) else Value

    @field_validator("Email")
    @classmethod
    def CheckEmail(cls, Value):
        if Value and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+",Value):
            raise ValueError("Correo inválido.")
        return Value

class PasswordEdit(StrictModel):
    CurrentPassword: str = Field(min_length=1,max_length=128)
    NewPassword: str = Field(min_length=12,max_length=128)

class UserEdit(StrictModel):
    RoleName: Literal["Administrator","Editor","Viewer"]
    IsActive: bool = Field(strict=True)
    Version: int = Field(ge=1,strict=True)


