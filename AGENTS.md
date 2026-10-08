# AGENTS.md — erp-ai (AI-ERP with n8n)

Compact guide for AI agents working in this repo. `README.md` has the full write-up; read it for anything not covered here.

## Project

A small, **learning-oriented** ERP for a fictional Israeli electronics business, built with **n8n**, **AI agents**, and **RAG**. Everything is deliberately simple: short workflows, no clever abstractions.

**Scope is n8n Cloud + Airtable only.** No Docker, no Go, no backend, no SQLite, no React — nothing installed or run locally. Airtable is the database and the UI; n8n Cloud runs the automation; documents render to PDF and live in Google Drive. If a task can be solved in a workflow node, it does not get code.

The **live n8n instance is the source of truth** for workflows. `workflows/` holds a placeholdered reference export of each one and nothing syncs it back; `docs/screenshots/` holds canvas screenshots.

## Commands

`node workflows/check.mjs` — the only runnable thing in the repo. Checks the workflow exports (valid JSON, no dangling connections, documented credential names) and runs WF1's validator against the Israeli VAT rules. Nothing to build, install or lint; all real execution happens in n8n Cloud.

`schema/schema.json` is the source of truth for the 8 tables. Build them in the Airtable base by hand and add records yourself.

## Architecture

```
                     ┌──────────────┐
  Telegram bot #1 ──▶│              │──▶ Airtable  (the database)
  (manager)          │              │
  Telegram bot #2 ──▶│  n8n Cloud   │──▶ Gmail     (sales emails)
  (customers)        │  + AI agents │──▶ Drive     (documents + PDFs)
                     │  + vectorDB  │
  Gmail  ───────────▶│              │
  Schedules ────────▶└──────────────┘
                            ▲
                            │  chat model · embeddings model
```

n8n Cloud provides the public HTTPS URL, so Telegram triggers and webhooks work with no tunnel.

### Models

Both are set in their n8n credentials and swappable — no workflow is tied to a vendor.

- **Chat**: any OpenAI-compatible endpoint. ⚠️ With a *reasoning* model, never set a small `max_tokens`, or `content` comes back empty.
- **Embeddings**: a separate OpenAI-compatible endpoint. Must be **multilingual** so Hebrew embeds properly. Separate because a chat endpoint does not necessarily serve `/v1/embeddings` — verify before assuming one endpoint covers both.

## Repo layout

```
schema/schema.json     ← single source of truth (8 tables). Everything reads this.
mock/policies/         ← policy/business-rule docs (*.md) for RAG — uploaded to Drive
templates/             ← invoice / receipt / quote HTML (RTL Hebrew)
workflows/             ← importable n8n exports (placeholdered) + check.mjs
docs/                  ← step-by-step setup guides + canvas screenshots
```

## Known limitations (deliberate, for simplicity)

- **The vector store and agent memory are in-memory** — both are wiped when the instance restarts. Re-run the embedding workflows.
- **No local filesystem.** On n8n Cloud the workflows cannot read repo files; policy documents and templates come from Google Drive or live inside the workflow.
- **Airtable triggers poll at ≥1 minute**, and fire off a `Created time` field (Airtable has no true "on create" event).
- **Sequential invoice numbering can race** if two documents are created inside the same poll window.
- **Google OAuth in "Testing" mode** expires refresh tokens after 7 days.
- **Relationships are string foreign keys** (`CUST-0001`), not Airtable links.

## Conventions

- All user-facing text and document content is **Hebrew (RTL)**.
- Deliberately simple: short workflows, no clever abstractions, nothing that needs installing.
- `schema/schema.json` is the single source of truth — everything reads it.
- Secrets live in n8n credentials only — never in source, never in git.
