"""
Three-database connection manager.

Every database role (MAIN / SECONDARY / LOCAL) gets its own independent
motor client. Business code must select a role explicitly — it is
impossible to accidentally read the wrong database because each role
exposes only its own collections.

Roles:
    MAIN      production source of truth
    SECONDARY verification replica (written only by the sync worker)
    LOCAL     admin-triggered replica
"""

from __future__ import annotations

import asyncio
import logging
import motor.motor_asyncio

from ..config import settings

logger = logging.getLogger(__name__)

# Role names are the source of truth for database selection.
ROLE_MAIN = "MAIN"
ROLE_SECONDARY = "SECONDARY"
ROLE_LOCAL = "LOCAL"

_clients: dict[str, motor.motor_asyncio.AsyncIOMotorClient] = {}
_databases: dict[str, motor.motor_asyncio.AsyncIOMotorDatabase] = {}


def _resolve(role: str) -> tuple[str, str]:
    """Return (uri, db_name) for the given role."""
    if role == ROLE_MAIN:
        return settings.resolve_main_uri(), settings.resolve_main_db()
    if role == ROLE_SECONDARY:
        return settings.resolve_secondary_uri(), settings.resolve_secondary_db()
    if role == ROLE_LOCAL:
        return settings.resolve_local_uri(), settings.resolve_local_db()
    raise ValueError(f"Unknown database role: {role}")


def get_client(role: str) -> motor.motor_asyncio.AsyncIOMotorClient:
    """Return the role-specific motor client, creating it once."""
    role = role.upper()
    if role not in _clients:
        uri, _ = _resolve(role)
        logger.info(f"Creating new motor client for role: {role}")
        _clients[role] = motor.motor_asyncio.AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=30000,  # Added socket timeout for long-running queries
            maxPoolSize=100,  # Configure pool size
            minPoolSize=5,
        )
    return _clients[role]


def get_database(role: str) -> motor.motor_asyncio.AsyncIOMotorDatabase:
    """Return the role-specific database object. NEVER cross roles."""
    role = role.upper()
    if role not in _databases:
        uri, db_name = _resolve(role)
        _databases[role] = motor.motor_asyncio.AsyncIOMotorDatabase(get_client(role), db_name)
        logger.info(f"Database object retrieved for role: {role}, db: {db_name}")
    return _databases[role]


async def ping(role: str) -> bool:
    """Ping a database role. Returns True when reachable within 3 s."""
    try:
        await asyncio.wait_for(
            get_client(role).admin.command("ping"),
            timeout=3.0,
        )
        logger.debug(f"Ping successful for role: {role}")
        return True
    except Exception as e:
        logger.warning(f"Ping failed for role {role}: {e}")
        return False


async def close_all() -> None:
    """Close all role clients. Call on application shutdown."""
    logger.info("Closing all database connections")
    for role, client in _clients.items():
        try:
            client.close()
            logger.info(f"Closed connection for role: {role}")
        except Exception as e:
            logger.error(f"Error closing connection for role {role}: {e}")
    _clients.clear()
    _databases.clear()
    logger.info("All database connections closed")
