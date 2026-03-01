from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    APP_NAME: str = "ASD Screening Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    DATABASE_URL: str = "mysql+pymysql://root:password@localhost:3306/asd_platform"
    
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    ML_MODELS_PATH: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml_models")
    
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_PERIOD: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
