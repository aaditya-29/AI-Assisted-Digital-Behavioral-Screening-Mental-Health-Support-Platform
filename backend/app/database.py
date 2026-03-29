from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings
from urllib.parse import urlparse, parse_qs

parsed = urlparse(settings.DATABASE_URL)
qs = parse_qs(parsed.query)

# If the DATABASE_URL contains an `ssl` query flag (e.g. ?ssl=true),
# build an engine URL without the query string and pass a dict to PyMySQL
# via connect_args so it creates an SSL context. This avoids the URL's
# string query value being forwarded directly to PyMySQL (which expects a
# mapping for the `ssl` parameter).
connect_args = None
engine_url = settings.DATABASE_URL
if 'ssl' in qs:
    # remove query part from engine URL
    from urllib.parse import urlunparse
    engine_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
    connect_args = {'ssl': {}}

engine = create_engine(
    engine_url,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
