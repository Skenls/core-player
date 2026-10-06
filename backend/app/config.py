from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings"""
    
    # Security
    secret_key: str = Field(..., env="SECRET_KEY")
    encryption_key: str = Field(..., env="ENCRYPTION_KEY")
    
    # Database
    database_url: str = Field(default="sqlite+aiosqlite:///./navidrome_player.db", env="DATABASE_URL")
    
    # CORS
    cors_origins: str = Field(default="http://localhost:3000", env="CORS_ORIGINS")
    
    # Session
    session_expire_days: int = Field(default=30, env="SESSION_EXPIRE_DAYS")
    
    # Development
    dev_navidrome_url: str | None = Field(default=None, env="DEV_NAVIDROME_URL")
    dev_navidrome_user: str | None = Field(default=None, env="DEV_NAVIDROME_USER")
    dev_navidrome_pass: str | None = Field(default=None, env="DEV_NAVIDROME_PASS")
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
