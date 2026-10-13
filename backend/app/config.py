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
    
    # Navidrome connection
    navidrome_network_mode: str = Field(default="local", env="NAVIDROME_NETWORK_MODE")
    navidrome_url: str = Field(default="http://localhost:4533", env="NAVIDROME_URL")
    navidrome_user: str = Field(default="skenls", env="NAVIDROME_USER")
    navidrome_pass: str | None = Field(default=None, env="NAVIDROME_PASS")
    navidrome_token: str | None = Field(default=None, env="NAVIDROME_TOKEN")
    navidrome_salt: str | None = Field(default=None, env="NAVIDROME_SALT")
    
    # Initial Admin Bootstrap
    initial_admin_username: str = Field(default="admin", env="INITIAL_ADMIN_USERNAME")
    initial_admin_password: str = Field(default="admin123", env="INITIAL_ADMIN_PASSWORD")
    
    # Development
    dev_navidrome_url: str | None = Field(default=None, env="DEV_NAVIDROME_URL")
    dev_navidrome_user: str | None = Field(default=None, env="DEV_NAVIDROME_USER")
    dev_navidrome_pass: str | None = Field(default=None, env="DEV_NAVIDROME_PASS")
    
    class Config:
        env_file = ("backend/.env", ".env")
        extra = "ignore"
        case_sensitive = False
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
