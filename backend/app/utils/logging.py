import logging
import sys
from app.config import settings


def setup_logging():
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL),
        format=settings.LOG_FORMAT,
        handlers=[
            logging.StreamHandler(sys.stdout),
        ]
    )
    
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    
    return logging.getLogger(__name__)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


logger = setup_logging()
