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


async def _get_all_google_user_ids() -> list:
    from app.repositories.connected_account_repo import ConnectedAccountRepository
    user_ids = []
    async with AsyncSessionLocal() as session:
        try:
            ca_repo = ConnectedAccountRepository(session)
            accounts = await ca_repo.get_all_google_accounts()
            user_ids = [account.user_id for account in accounts]
        except Exception as exc:
            logger.error("Scheduler: failed to fetch accounts: %s", exc)
    return user_ids


async def _run_all_meeting_preps() -> None:
    from app.services.meeting_prep import prepare_upcoming_meetings
    logger.info("⏰ Scheduler: running pre-meeting briefings for all users")
    user_ids = await _get_all_google_user_ids()
    for user_id in user_ids:
        async with AsyncSessionLocal() as session:
            try:
                await prepare_upcoming_meetings(session, user_id)
            except Exception as exc:
                logger.error("Meeting prep failed for user_id=%s: %s", user_id, exc)


async def _run_all_escalations() -> None:
    from app.services.escalation import escalate_overdue_followups
    logger.info("⏰ Scheduler: running follow-up escalations for all users")
    user_ids = await _get_all_google_user_ids()
    for user_id in user_ids:
        async with AsyncSessionLocal() as session:
            try:
                await escalate_overdue_followups(session, user_id)
            except Exception as exc:
                logger.error("Escalation failed for user_id=%s: %s", user_id, exc)


async def _run_all_morphs() -> None:
    from app.services.escalation import morph_urgent_tasks
    logger.info("⏰ Scheduler: morphing urgent tasks for all users")
    user_ids = await _get_all_google_user_ids()
    for user_id in user_ids:
        async with AsyncSessionLocal() as session:
            try:
                await morph_urgent_tasks(session, user_id)
            except Exception as exc:
                logger.error("Morph failed for user_id=%s: %s", user_id, exc)


def start_scheduler() -> None:
    """Configure and start APScheduler. Called during FastAPI lifespan startup."""
    from apscheduler.triggers.cron import CronTrigger
    interval_minutes = settings.gmail_sync_interval_min

    scheduler.add_job(
        _run_all_incremental_syncs,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="gmail_sync",
        name="Gmail 15-min incremental sync",
        replace_existing=True,
    )

    scheduler.add_job(
        _run_all_meeting_preps,
        trigger=IntervalTrigger(minutes=30),
        id="meeting_prep",
        name="Pre-Meeting Briefings",
        replace_existing=True,
    )

    # Escalations and Morphing run daily (e.g. 8:00 AM)
    scheduler.add_job(
        _run_all_escalations,
        trigger=CronTrigger(hour=8, minute=0),
        id="escalation",
        name="Follow-up Escalations",
        replace_existing=True,
    )

    scheduler.add_job(
        _run_all_morphs,
        trigger=CronTrigger(hour=8, minute=5),
        id="morphing",
        name="Priority Morphing",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        "⏰ Schedulers started (Sync=%d min, Prep=30 min, Escalate/Morph=Daily 8AM)", interval_minutes
    )


def stop_scheduler() -> None:
    """Gracefully shut down APScheduler. Called during FastAPI lifespan shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
