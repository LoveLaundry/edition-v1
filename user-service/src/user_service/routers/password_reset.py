"""Password reset functionality with email-based token reset."""
from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import bcrypt

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field

from ..auth_helper import get_current_user
from ..database.main_db import users_collection, password_reset_tokens_collection
from ..repository_factory import get_repository
from ..repository import UserRepository
from ..tenancy import resolve_laundry_id

router = APIRouter(prefix="/password-reset", tags=["password-reset"])


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(..., min_length=32, max_length=64)
    new_password: str = Field(..., min_length=8, max_length=128)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


# Token expiration: 1 hour
TOKEN_EXPIRY_HOURS = 1


def _generate_reset_token() -> str:
    """Generate a cryptographically secure reset token."""
    return secrets.token_urlsafe(32)


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


@router.post("/request")
async def request_password_reset(
    payload: PasswordResetRequest,
    repo: UserRepository = Depends(get_repository),
):
    """Request a password reset email.

    This endpoint always returns success to prevent email enumeration.
    If the email doesn't exist, no email is sent but the request still succeeds.
    """
    try:
        user = repo.get_by_email(payload.email)
    except Exception:
        user = None

    if user:
        # Generate and store reset token
        token = _generate_reset_token()
        expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)

        await password_reset_tokens_collection.insert_one({
            "user_id": user["id"],
            "email": payload.email,
            "token": token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
            "used": False,
        })

        # In production, send email here
        # For now, we'll log the token (REMOVE IN PRODUCTION)
        print(f"Password reset token for {payload.email}: {token}")
        print(f"Reset link: https://lovelaundry.lk/reset-password?token={token}")

    # Always return success to prevent email enumeration
    return {
        "message": "If an account with this email exists, a password reset link has been sent.",
        "expires_in_hours": TOKEN_EXPIRY_HOURS,
    }


@router.post("/confirm")
async def confirm_password_reset(payload: PasswordResetConfirm):
    """Confirm a password reset using the token from email."""
    # Find valid token
    token_doc = await password_reset_tokens_collection.find_one({
        "token": payload.token,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })

    if not token_doc:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token. Please request a new password reset."
        )

    # Get user
    user_id = token_doc["user_id"]
    user = await users_collection.find_one({"_id": user_id})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update password
    hashed_password = _hash_password(payload.new_password)
    await users_collection.update_one(
        {"_id": user_id},
        {"$set": {"password": hashed_password}}
    )

    # Mark token as used
    await password_reset_tokens_collection.update_one(
        {"_id": token_doc["_id"]},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
    )

    # Invalidate all other reset tokens for this user
    await password_reset_tokens_collection.update_many(
        {"user_id": user_id, "used": False},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc), "invalidated": True}}
    )

    return {"message": "Password has been reset successfully. You can now log in with your new password."}


@router.post("/change")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: dict = Depends(get_current_user),
    repo: UserRepository = Depends(get_repository),
):
    """Change password for authenticated user (requires current password)."""
    user_id = current_user.get("user_id")
    user = repo.get_by_id(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify current password
    try:
        if not bcrypt.checkpw(
            payload.current_password.encode("utf-8"),
            user["password"].encode("utf-8")
        ):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    except ValueError:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Update password
    hashed_password = _hash_password(payload.new_password)
    repo.update_password(user_id, payload.new_password)

    return {"message": "Password changed successfully"}


@router.get("/validate-token/{token}")
async def validate_reset_token(token: str):
    """Validate if a reset token is still valid (for UI feedback)."""
    token_doc = await password_reset_tokens_collection.find_one({
        "token": token,
        "used": False,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    })

    if not token_doc:
        return {"valid": False, "message": "Invalid or expired token"}

    return {"valid": True, "message": "Token is valid"}
