from __future__ import annotations

import json

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.config import OPENROUTER_MODEL_DEFAULT
from backend.database import get_db
from backend.models import ChatMessage
from backend.schemas.chat import ChatRequest, ChatResponse
from backend.services.openrouter import OpenRouterConfigError, generate_reply, stream_reply

logger = logging.getLogger(__name__)


router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    try:
        reply, model_name = await generate_reply(
            user_message=payload.message,
            history=[item.dict() for item in payload.history],
            model=payload.model,
        )
    except OpenRouterConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error in chat endpoint")
        raise HTTPException(status_code=500, detail="Erro interno no servidor de chat.") from exc

    resolved_model = payload.model or model_name or OPENROUTER_MODEL_DEFAULT

    # Persistimos apenas o fluxo basico de mensagens; sessoes e titulos sao tarefa do participante.
    db.add(ChatMessage(session_key="default", role="user", content=payload.message, model=resolved_model))
    db.add(ChatMessage(session_key="default", role="assistant", content=reply, model=resolved_model))
    db.commit()

    return ChatResponse(reply=reply, model=resolved_model)


@router.post("/api/chat/stream")
async def chat_stream(payload: ChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    resolved_model = payload.model or OPENROUTER_MODEL_DEFAULT

    async def event_generator():
        full_reply = ""
        try:
            async for delta in stream_reply(
                user_message=payload.message,
                history=[item.dict() for item in payload.history],
                model=payload.model,
            ):
                full_reply += delta
                yield f"data: {json.dumps({'delta': delta}, ensure_ascii=True)}\n\n"
        except OpenRouterConfigError as exc:
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=True)}\n\n"
            return
        except RuntimeError as exc:
            yield f"data: {json.dumps({'error': str(exc)}, ensure_ascii=True)}\n\n"
            return
        except Exception as exc:
            logger.exception("Unexpected error in chat stream endpoint")
            yield f"data: {json.dumps({'error': 'Erro interno no servidor de stream de chat.'}, ensure_ascii=True)}\n\n"
            return

        if full_reply.strip():
            db.add(
                ChatMessage(
                    session_key="default",
                    role="user",
                    content=payload.message,
                    model=resolved_model,
                )
            )
            db.add(
                ChatMessage(
                    session_key="default",
                    role="assistant",
                    content=full_reply,
                    model=resolved_model,
                )
            )
            db.commit()

        yield f"data: {json.dumps({'done': True}, ensure_ascii=True)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
