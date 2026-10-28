from .app_time import stamp
from datetime import datetime
from typing import Union
from pydantic import BaseModel, EmailStr, field_serializer, field_validator, ConfigDict


class UserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    
    user_name: str
    bio_data: str | None = None
    user_dp: str | None = None
    mobile_number: str | None = None
    email: EmailStr | None = None
    role_id: str
    employee_id: str | None = None
    auth_id: str
    password: str
    status: str = "unset"
    tenant: str | None = None
    public_key: str | None = None
    key_version: int | None = 1
    permissions: str | None = None

    @field_validator('user_name')
    @classmethod
    def validate_user_name(cls, v: str) -> str:
        if len(v) < 1 or len(v) > 120:
            raise ValueError('user_name must be between 1 and 120 characters')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('password must be at least 8 characters')
        if len(v) > 128:
            raise ValueError('password must not exceed 128 characters')
        return v

    @field_validator('auth_id')
    @classmethod
    def validate_auth_id(cls, v: str) -> str:
        if len(v) < 3 or len(v) > 64:
            raise ValueError('auth_id must be between 3 and 64 characters')
        return v


class UserUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    
    user_name: str | None = None
    bio_data: str | None = None
    user_dp: str | None = None
    mobile_number: str | None = None
    email: EmailStr | None = None
    role_id: str | None = None
    employee_id: str | None = None
    auth_id: str | None = None
    password: str | None = None
    status: str | None = None
    public_key: str | None = None
    key_version: int | None = None
    permissions: str | None = None

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str | None) -> str | None:
        if v is not None:
            if len(v) < 8:
                raise ValueError('password must be at least 8 characters')
            if len(v) > 128:
                raise ValueError('password must not exceed 128 characters')
        return v


class UserPasswordUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('password must be at least 8 characters')
        if len(v) > 128:
            raise ValueError('password must not exceed 128 characters')
        return v


class UserStatusUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    
    status: str

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = {'active', 'inactive', 'disabled', 'suspended', 'blocked', 'deleted', 'unset'}
        if v.lower() not in valid_statuses:
            raise ValueError(f'status must be one of {valid_statuses}')
        return v.lower()


class UserResponse(BaseModel):
    id: Union[int, str]
    user_name: str
    bio_data: str | None = None
    user_dp: str | None = None
    mobile_number: str | None = None
    email: str | None = None
    role_id: str
    employee_id: str | None = None
    auth_id: str
    status: str
    tenant: str | None = None
    public_key: str | None = None
    key_version: int | None = None
    permissions: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return stamp(value)

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse