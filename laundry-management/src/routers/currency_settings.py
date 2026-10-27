"""Currency configuration and management."""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from ..database.main_db import laundries_collection
from ..auth_helper import require_role, get_current_user
from ..tenancy import resolve_laundry_id

router = APIRouter(prefix="/currency", tags=["currency"])


# Supported currencies with their ISO codes and symbols
SUPPORTED_CURRENCIES = {
    "LKR": {"name": "Sri Lankan Rupee", "symbol": "Rs", "code": "LKR", "decimal_places": 2},
    "USD": {"name": "US Dollar", "symbol": "$", "code": "USD", "decimal_places": 2},
    "EUR": {"name": "Euro", "symbol": "€", "code": "EUR", "decimal_places": 2},
    "GBP": {"name": "British Pound", "symbol": "£", "code": "GBP", "decimal_places": 2},
    "INR": {"name": "Indian Rupee", "symbol": "₹", "code": "INR", "decimal_places": 2},
    "AED": {"name": "UAE Dirham", "symbol": "د.إ", "code": "AED", "decimal_places": 2},
    "SGD": {"name": "Singapore Dollar", "symbol": "S$", "code": "SGD", "decimal_places": 2},
    "MYR": {"name": "Malaysian Ringgit", "symbol": "RM", "code": "MYR", "decimal_places": 2},
}


class CurrencyConfig(BaseModel):
    default_currency: str = Field(..., description="ISO currency code (e.g., LKR, USD)")
    enabled_currencies: List[str] = Field(default_factory=list, description="List of enabled currency codes")
    exchange_rates: Optional[dict] = Field(default_factory=dict, description="Exchange rates relative to default currency")


class CurrencyResponse(BaseModel):
    default_currency: str
    enabled_currencies: List[str]
    exchange_rates: dict
    currency_info: dict


@router.get("/supported")
async def get_supported_currencies():
    """Get list of all supported currencies with their details."""
    return SUPPORTED_CURRENCIES


@router.get("/config")
async def get_currency_config(
    current_user: dict = Depends(get_current_user),
):
    """Get currency configuration for the current laundry."""
    laundry_id = resolve_laundry_id(current_user)
    
    laundry = await laundries_collection.find_one({"laundry_id": laundry_id})
    if not laundry:
        raise HTTPException(status_code=404, detail="Laundry not found")
    
    config = laundry.get("currency_config", {
        "default_currency": "LKR",
        "enabled_currencies": ["LKR"],
        "exchange_rates": {}
    })
    
    return CurrencyResponse(
        **config,
        currency_info=SUPPORTED_CURRENCIES
    )


@router.put("/config")
async def update_currency_config(
    config: CurrencyConfig,
    current_user: dict = Depends(require_role(["ADMIN", "MANAGER"])),
):
    """Update currency configuration for the laundry."""
    laundry_id = resolve_laundry_id(current_user)
    
    # Validate currencies
    if config.default_currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {config.default_currency}")
    
    for currency in config.enabled_currencies:
        if currency not in SUPPORTED_CURRENCIES:
            raise HTTPException(status_code=400, detail=f"Unsupported currency: {currency}")
    
    # Ensure default currency is in enabled list
    if config.default_currency not in config.enabled_currencies:
        config.enabled_currencies.append(config.default_currency)
    
    # Update laundry config
    result = await laundries_collection.update_one(
        {"laundry_id": laundry_id},
        {"$set": {"currency_config": config.model_dump()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Laundry not found")
    
    return {"message": "Currency configuration updated successfully"}


@router.post("/exchange-rates")
async def update_exchange_rates(
    rates: dict,
    current_user: dict = Depends(require_role(["ADMIN", "MANAGER"])),
):
    """Update exchange rates for enabled currencies."""
    laundry_id = resolve_laundry_id(current_user)
    
    laundry = await laundries_collection.find_one({"laundry_id": laundry_id})
    if not laundry:
        raise HTTPException(status_code=404, detail="Laundry not found")
    
    config = laundry.get("currency_config", {
        "default_currency": "LKR",
        "enabled_currencies": ["LKR"],
        "exchange_rates": {}
    })
    
    # Validate rates
    for currency, rate in rates.items():
        if currency not in SUPPORTED_CURRENCIES:
            raise HTTPException(status_code=400, detail=f"Unsupported currency: {currency}")
        if not isinstance(rate, (int, float)) or rate <= 0:
            raise HTTPException(status_code=400, detail=f"Invalid rate for {currency}")
    
    config["exchange_rates"].update(rates)
    
    await laundries_collection.update_one(
        {"laundry_id": laundry_id},
        {"$set": {"currency_config": config}}
    )
    
    return {"message": "Exchange rates updated successfully"}
