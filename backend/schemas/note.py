from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    original_filename: str
    is_indexed: bool
    created_at: datetime
