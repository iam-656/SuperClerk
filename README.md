# SuperClerk — AI Operating System for Small Businesses

SuperClerk is an intelligent AI Operating System designed for small businesses. It understands your business data, takes intelligent actions, and automates routine operations through specialized AI employees.

## 🚀 Vision

An AI-powered system where specialized agents handle routine business operations:
- **Gmail Agent** — reads, analyzes, and responds to emails with human approval
- More agents coming soon...

## 🏗️ Architecture

```
Frontend (Next.js + TypeScript + Tailwind + shadcn/ui)
    ↓
API Gateway (FastAPI)
    ↓
Auth Service (Google OAuth)
    ↓
Agent Orchestrator
    ↓
Specialized Agents (Gmail, Calendar, etc.)
    ↓
Google Services
```

## 🤖 AI Layer

- **Planner Agent** — Breaks down tasks into steps
- **Decision Agent** — Chooses the best course of action
- **Execution Agent** — Carries out approved actions
- **Memory Agent** — Maintains business context

## 🗄️ Database Schema

- Users, Connected Accounts, Emails, Email Summaries
- Tasks, Agent Actions, Approvals, Memory, Audit Logs

## 🛠️ Tech Stack

| Layer       | Technology                              |
|-------------|------------------------------------------|
| Frontend    | Next.js, TypeScript, Tailwind, shadcn/ui |
| Backend     | FastAPI, Python, SQLAlchemy, Celery       |
| Database    | PostgreSQL (Supabase), pgvector, Redis    |
| AI          | Gemini 2.5, Google SDK                   |
| Auth        | Google OAuth                              |

## 📋 Branch Strategy

| Branch       | Purpose                          |
|--------------|----------------------------------|
| `main`       | Production-ready code            |
| `develop`    | Integration branch               |
| `feature/*`  | New feature development          |
| `hotfix/*`   | Emergency production fixes       |

## 📁 Project Rules

See [`rules/`](./rules/) for coding standards and [`architectures/`](./architectures/) for system design.

---

*Built with ❤️ by SuperClerk Team*
