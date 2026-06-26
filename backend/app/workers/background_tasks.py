# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Background Task Workers
# Uses FastAPI's built-in BackgroundTasks (no Redis/Celery).
# Tasks are enqueued per-request and run after the response
# is returned to the client.
#
# Phase 3: Placeholder implementations — logging only.
# Phase 4: Will add Gmail fetch + AI processing logic here.
# ─────────────────────────────────────────────────────────────

import logging
import uuid

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# Email Processing
# ─────────────────────────────────────────────────────────────

async def process_email_task(email_id: uuid.UUID) -> None:
    """
    Process a fetched email through the AI pipeline.
    
    Phase 4 will implement:
    1. Parse email content
    2. Summarize with Gemini
    3. Classify and prioritize
    4. Generate agent action proposal
    5. Create Approval record for CEO review
    
    Currently: logs receipt only.
    """
    logger.info("[BG] process_email_task started | email_id=%s", email_id)
    # TODO(phase-4): Implement Gmail parser → Summarizer → Classifier → Decision Agent
    logger.info("[BG] process_email_task completed | email_id=%s", email_id)


# ─────────────────────────────────────────────────────────────
# Gmail Sync
# ─────────────────────────────────────────────────────────────

async def sync_gmail_inbox_task(user_id: uuid.UUID) -> None:
    """
    Pull latest emails from Gmail API and store them in the DB.
    
    Phase 4 will implement:
    1. Load OAuth tokens from ConnectedAccount
    2. Call Gmail API (list messages → fetch each)
    3. Deduplicate by gmail_id
    4. Insert new emails and enqueue process_email_task
    
    Currently: logs receipt only.
    """
    logger.info("[BG] sync_gmail_inbox_task started | user_id=%s", user_id)
    # TODO(phase-4): Implement Gmail API connector
    logger.info("[BG] sync_gmail_inbox_task completed | user_id=%s", user_id)


# ─────────────────────────────────────────────────────────────
# Action Execution
# ─────────────────────────────────────────────────────────────

async def execute_approved_action_task(agent_action_id: uuid.UUID) -> None:
    """
    Execute an agent action after CEO approval.

    Phase 4 will implement:
    1. Load AgentAction from DB
    2. Dispatch based on action_type (send_email, archive, create_task, etc.)
    3. Update AgentAction.status = executed | failed
    4. Write AuditLog entry
    
    Currently: logs receipt only.
    """
    logger.info(
        "[BG] execute_approved_action_task started | action_id=%s", agent_action_id
    )
    # TODO(phase-4): Implement action executor + audit logging
    logger.info(
        "[BG] execute_approved_action_task completed | action_id=%s", agent_action_id
    )
