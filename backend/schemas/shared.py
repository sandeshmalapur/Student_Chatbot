from pydantic import BaseModel, Field
from schemas.chat import MessageOut


class SharedLinkOut(BaseModel):
    token: str
    share_path: str  # frontend route, e.g. "/shared/<token>"


class SharedNoteInfo(BaseModel):
    note_title: str
    is_active: bool
    messages: list[MessageOut] = []


class SharedMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)