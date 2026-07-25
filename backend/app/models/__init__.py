# ─────────────────────────────────────────────────────────────
# SuperClerk Backend — Models Package
# Exports all ORM models so Alembic can discover them.
# ─────────────────────────────────────────────────────────────

from app.models.user import User
from app.models.connected_account import ConnectedAccount
from app.models.email import Email
from app.models.email_summary import EmailSummary
from app.models.reminder import Reminder
from app.models.task import Task
from app.models.agent_action import AgentAction
from app.models.approval import Approval
from app.models.memory import Memory
from app.models.audit_log import AuditLog

__all__ = [
    "User",
    "ConnectedAccount",
    "Email",
    "EmailSummary",
    "Task",
    "AgentAction",
    "Approval",
    "Memory",
    "AuditLog",
]
