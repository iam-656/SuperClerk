# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Pub/Sub Pull Worker
# Runs as a background asyncio task inside FastAPI.
# Continuously pulls inbox-change events from Google Cloud
# Pub/Sub (no ngrok needed — works on localhost).
#
# When Gmail detects a new email, it posts to our Pub/Sub Topic.
# This worker pulls that message, triggers incremental_sync for
# the affected user, then acks the message so it isn't repeated.
# ─────────────────────────────────────────────────────────────

import asyncio
import base64
import json
import logging

from google.cloud import pubsub_v1

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.services.gmail_service import incremental_sync

logger = logging.getLogger(__name__)
settings = get_settings()


async def pubsub_pull_worker() -> None:
    """
    Long-running async task. Pulls Pub/Sub messages in a tight loop.
    Started during FastAPI lifespan and cancelled on shutdown.
    """
    subscription = settings.google_pubsub_subscription
    if not subscription:
        logger.warning(
            "GOOGLE_PUBSUB_SUBSCRIPTION not set — Pub/Sub worker will not start"
        )
        return

    logger.info("📬 Pub/Sub pull worker starting | subscription=%s", subscription)

    subscriber = pubsub_v1.SubscriberClient()

    while True:
        try:
            # Pull up to 5 messages at a time (non-blocking)
            response = subscriber.pull(
                request={
                    "subscription": subscription,
                    "max_messages": 5,
                },
                timeout=20,
            )

            if not response.received_messages:
                # Nothing in the queue — sleep briefly before next poll
                await asyncio.sleep(5)
                continue

            ack_ids = []
            for received_msg in response.received_messages:
                try:
                    # Decode the Pub/Sub message payload
                    data = json.loads(
                        base64.b64decode(received_msg.message.data).decode("utf-8")
                    )
                    email_address = data.get("emailAddress")

                    if email_address:
                        logger.info(
                            "Pub/Sub event received for email=%s", email_address
                        )
                        # Trigger incremental sync for this user
                        await _sync_user_by_email(email_address)

                    ack_ids.append(received_msg.ack_id)

                except Exception as exc:
                    logger.error(
                        "Failed to process Pub/Sub message: %s", exc, exc_info=True
                    )
                    # Still ack to avoid infinite retries on malformed messages
                    ack_ids.append(received_msg.ack_id)

            # Acknowledge processed messages
            if ack_ids:
                subscriber.acknowledge(
                    request={"subscription": subscription, "ack_ids": ack_ids}
                )

        except asyncio.CancelledError:
            logger.info("Pub/Sub pull worker cancelled — shutting down")
            break
        except Exception as exc:
            logger.error("Pub/Sub pull error: %s — retrying in 10s", exc)
            await asyncio.sleep(10)

    subscriber.close()
    logger.info("Pub/Sub pull worker stopped")


async def _sync_user_by_email(email_address: str) -> None:
    """Look up a user by email and trigger an incremental Gmail sync."""
    from app.repositories.user_repo import UserRepository

    async with AsyncSessionLocal() as session:
        try:
            user_repo = UserRepository(session)
            user = await user_repo.get_by_email(email_address)
            if not user:
                logger.warning(
                    "Pub/Sub: no user found for email=%s", email_address
                )
                return

            result = await incremental_sync(session, user.id)
            logger.info(
                "Pub/Sub sync complete: email=%s result=%s", email_address, result
            )
        except Exception as exc:
            await session.rollback()
            logger.error(
                "Pub/Sub sync failed for email=%s: %s", email_address, exc, exc_info=True
            )
