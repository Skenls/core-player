from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all models"""
    pass


async def init_db():
    """Initialize database tables and bootstrap initial admin user if none exist"""
    # Import models so Base.metadata knows about them
    import app.models as models  # noqa
    
    async with engine.begin() as conn:
        def check_and_migrate(sync_conn):
            from sqlalchemy import inspect, text
            inspector = inspect(sync_conn)
            if "sessions" in inspector.get_table_names():
                columns = [col["name"] for col in inspector.get_columns("sessions")]
                if "navidrome_url" in columns:
                    sync_conn.execute(text("DROP TABLE sessions"))

        await conn.run_sync(check_and_migrate)
        await conn.run_sync(Base.metadata.create_all)
    
    # Check if any user exists
    from app.models import User
    from app.auth import hash_password
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).limit(1))
        existing_user = result.scalar_one_or_none()
        if not existing_user:
            admin_user = User(
                username=settings.initial_admin_username,
                password_hash=hash_password(settings.initial_admin_password),
                role="admin"
            )
            session.add(admin_user)
            await session.commit()


async def get_db() -> AsyncSession:
    """Dependency for getting async database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
