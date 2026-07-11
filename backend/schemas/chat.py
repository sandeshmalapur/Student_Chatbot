from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatSessionCreate(BaseModel):
    note_id: int
    title: str = Field(default="New Chat", max_length=255)


class ChatSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    note_id: int
    title: str
    created_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    answer_language: str = Field(default="en", max_length=10)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    image_urls: list[str] = Field(default_factory=list)
    answer_language: str | None = "en"
    created_at: datetime

    @field_validator("image_urls", mode="before")
    @classmethod
    def _coerce_none_to_empty_list(cls, v):
        # the DB column is nullable; user messages and image-less answers store NULL
        return v or []