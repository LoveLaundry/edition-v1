from .app_time import stamp
from datetime import datetime
from typing import Union, Literal, Optional
from pydantic import BaseModel, Field, field_serializer, field_validator, ConfigDict


# ─── Order lifecycle ──────────────────────────────────────────────────────────
# Laundry-industry standard processing pipeline (received → washed → pressed →
# folded → packed → ready → out for delivery → delivered). A quotation/order
# moves through these stages; history is recorded on every transition.
ORDER_STATUSES = [
    "draft",
    "received",
    "washing",
    "pressing",
    "folding",
    "packing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
]

ORDER_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "draft": ["received", "cancelled"],
    "received": ["washing", "cancelled"],
    "washing": ["pressing", "cancelled"],
    "pressing": ["folding", "cancelled"],
    "folding": ["packing", "cancelled"],
    "packing": ["ready", "cancelled"],
    "ready": ["out_for_delivery", "cancelled"],
    "out_for_delivery": ["delivered", "cancelled"],
    "delivered": [],
    "cancelled": [],
}


class StatusHistoryEntry(BaseModel):
    status: str
    changed_at: str
    changed_by: Optional[str] = None
    note: Optional[str] = None


class SpecificationSchema(BaseModel):
    """A variant/specification of a line item (e.g. colour + size), each with its own agreed price."""
    model_config = ConfigDict(str_strip_whitespace=True)

    specification: str
    unit_price: float

    @field_validator('unit_price')
    @classmethod
    def validate_unit_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError('unit_price must be non-negative')
        if v > 1000000:
            raise ValueError('unit_price must not exceed 1,000,000')
        return v


class LineItemSchema(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    
    item_name: str
    category: str | None = None
    unit_price: float
    notes: str | None = None
    # Optional list of colour/size variants, each with a (possibly different) price.
    # unit_price remains the base/agreement price and is what bill_service matches by item_name.
    specifications: list[SpecificationSchema] | None = None

    @field_validator('item_name')
    @classmethod
    def validate_item_name(cls, v: str) -> str:
        if len(v) < 1 or len(v) > 200:
            raise ValueError('item_name must be between 1 and 200 characters')
        return v

    @field_validator('unit_price')
    @classmethod
    def validate_unit_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError('unit_price must be non-negative')
        if v > 1000000:
            raise ValueError('unit_price must not exceed 1,000,000')
        return v


class QuotationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    
    client_name: str
    quotation_title: str | None = None
    line_items: list[LineItemSchema] = Field(default_factory=list)
    status: str = "draft"
    tag: Literal["shop", "hotel"] = "shop"  # Tag for filtering quotations

    @field_validator('client_name')
    @classmethod
    def validate_client_name(cls, v: str) -> str:
        if len(v) < 1 or len(v) > 200:
            raise ValueError('client_name must be between 1 and 200 characters')
        return v

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ORDER_STATUSES:
            raise ValueError(f'status must be one of {ORDER_STATUSES}')
        return v


class QuotationUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    
    client_name: str | None = None
    quotation_title: str | None = None
    line_items: list[LineItemSchema] | None = None
    status: str | None = None
    tag: Literal["shop", "hotel"] | None = None

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in ORDER_STATUSES:
            raise ValueError(f'status must be one of {ORDER_STATUSES}')
        return v


class QuotationAdvanceStatus(BaseModel):
    """Advance an order to the next lifecycle stage."""
    model_config = ConfigDict(str_strip_whitespace=True)
    
    status: str
    note: str | None = None

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ORDER_STATUSES:
            raise ValueError(f'status must be one of {ORDER_STATUSES}')
        return v

    status: str
    note: Optional[str] = None


class QuotationResponse(BaseModel):
    id: Union[int, str]  # MongoDB uses string IDs, PostgreSQL uses integer IDs
    client_name: str
    quotation_title: str | None
    line_items: list[dict]
    status: str
    status_history: list[StatusHistoryEntry] = []
    tag: str = "shop"
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, value: datetime | None) -> str | None:
        if value is None:
            return None
        return stamp(value)

    model_config = {"from_attributes": True}


# ─── Garment tags (QR) ─────────────────────────────────────────────────────────
class TagCreate(BaseModel):
    """Request to mint QR tags for an order.

    `per_item=True` mints one tag per line item (labelled with the item name).
    Otherwise `count` loose tags are minted, optionally sharing `label`.
    """

    count: int = 1
    per_item: bool = False
    label: Optional[str] = None


class TagOut(BaseModel):
    id: Union[int, str]
    code: str
    quotation_id: Union[int, str]
    line_item_id: Optional[str] = None
    label: Optional[str] = None
    created_at: datetime | None = None
    tracking_url: str = ""

    @field_serializer("created_at")
    def serialize_dt(self, value: datetime | None) -> str | None:
        return stamp(value) if value else None


class TagsResponse(BaseModel):
    quotation_id: Union[int, str]
    tags: list[TagOut] = []
