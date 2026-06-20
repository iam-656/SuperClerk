API endpoints should remain thin.
Business logic belongs in services.
Database logic belongs in repositories.
Integrations belong in integrations.
Agents should never directly access the database.
Prefer async implementations.
Every endpoint requires validation.
Log meaningful events.
Handle failures gracefully.