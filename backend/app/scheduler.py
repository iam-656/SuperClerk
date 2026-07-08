# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — APScheduler
# 15-minute fallback polling. Catches any emails missed by
# the Pub/Sub worker (e.g. if the app was offline, Pub/Sub
# delivery window expired, or token expired and watch stopped).
# ─────────────────────────────────────────────────────────────

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler()


async def _run_all_incremental_syncs() -> None:
    """
    Job that runs every N minutes.
    Fetches all Google-connected users and runs incremental_sync for each.
    Each user gets its own session to avoid session state leakage.
    """
    from app.repositories.connected_account_repo import ConnectedAccountRepository
    from app.services.gmail_service import incremental_sync

    logger.info("⏰ Scheduler: running 15-min Gmail sync for all users")

    # First pass: collect user_ids using a short-lived session
    user_ids: list = []
    async with AsyncSessionLocal() as session:
        try:
            ca_repo = ConnectedAccountRepository(session)
            accounts = await ca_repo.get_all_google_accounts()
            user_ids = [account.user_id for account in accounts]
        except Exception as exc:
            logger.error("Scheduler: failed to fetch accounts: %s", exc, exc_info=True)
            return

    if not user_ids:
        logger.info("Scheduler: no Google accounts found — nothing to sync")
        return

    # Second pass: sync each user with an isolated session
    for user_id in user_ids:
        async with AsyncSessionLocal() as session:
            try:
                result = await incremental_sync(session, user_id)
                await session.commit()
                logger.info(
                    "Scheduler sync: user_id=%s result=%s",
                    user_id, result,
                )
            except Exception as exc:
                await session.rollback()
                logger.error(
                    "Scheduler sync failed for user_id=%s: %s",
                    user_id, exc,
                )


def start_scheduler() -> None:
    """Configure and start APScheduler. Called during FastAPI lifespan startup."""
    interval_minutes = settings.gmail_sync_interval_min

    scheduler.add_job(
        _run_all_incremental_syncs,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="gmail_sync",
        name="Gmail 15-min incremental sync",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        "⏰ Gmail sync scheduler started (interval=%d min)", interval_minutes
    )


def stop_scheduler() -> None:
    """Gracefully shut down APScheduler. Called during FastAPI lifespan shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
