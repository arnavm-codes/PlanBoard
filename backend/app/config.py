from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_user: str = "planit"
    postgres_password: str = "changeme"
    postgres_db: str = "planit"
    postgres_host: str = "db"
    postgres_port: int = 5432

    jwt_secret: str = "changeme"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    cors_origin: str = "http://localhost:5173"

    superadmin_username: str | None = None
    superadmin_password: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        """CORS_ORIGIN may be a single origin or a comma-separated list (e.g.
        to allow both localhost and a LAN IP at once during development)."""
        return [origin.strip() for origin in self.cors_origin.split(",") if origin.strip()]

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
