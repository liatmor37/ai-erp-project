# AI-ERP with n8n

A small, **learning-oriented** ERP for a fictional Israeli electronics business, built from **n8n**, **AI agents** and **RAG**. The whole thing is deliberately plain: short workflows, no clever abstractions, nothing to install.

Two services carry it. **Airtable** is both the database and the UI. **n8n Cloud** runs every workflow and hosts the agents, and renders documents to PDF into **Google Drive**. No Docker, no server, no local runtime.

---

## What's in the box

- **3 AI agents.** A **manager** agent (owner-only: analytics, documents, tasks), a **customer-service** agent (public, answers only from retrieved policy and catalogue data), and a **sales** agent (cold outreach plus a reply heartbeat).
- **9 workflows** — tax-document validation, contact intake and dedupe, sales outreach, two RAG embedding pipelines, and an HTML→PDF→Drive document pipeline. Importable exports live in `workflows/`.
- **RAG** over the business policies and the product catalogue, on n8n's built-in vector store.
- **Real Israeli tax rules** — 18% VAT (17% before 2025-01-01), sequential document numbering, and the חשבונית עסקה / חשבונית מס / קבלה distinction enforced in code.

> **No data ships with the repo.** `schema/schema.json` defines the 8 tables; you create them and fill them as you go. The RAG source documents are in `mock/policies/`.

---

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

Everything lives inside n8n Cloud, which hands you a public HTTPS URL on day one — so Telegram bots and webhooks work with no tunnel and no port forwarding.

### Models

Both are configured as n8n credentials and are swappable. No workflow is tied to a vendor.

- **Chat** — any OpenAI-compatible endpoint. n8n's OpenAI nodes will talk to it as soon as you override **Base URL** in the credential.
  ⚠️ With a *reasoning* model, never set a small `max_tokens` — `content` comes back empty.
- **Embeddings** — a second OpenAI-compatible endpoint, and it must be **multilingual** or Hebrew embeds badly. It is separate on purpose: a chat endpoint does not necessarily serve `/v1/embeddings`. Check before assuming one covers both.

---

## Quick start

### 1. Accounts

- an **n8n Cloud** workspace — <https://app.n8n.cloud>
- an **Airtable** base and personal access token — [docs/01-airtable.md](docs/01-airtable.md)
- **two Telegram bots** — [docs/02-telegram-bots.md](docs/02-telegram-bots.md)
- **Google OAuth** for Gmail and Drive — [docs/03-google-oauth.md](docs/03-google-oauth.md)
- a **chat** endpoint and an **embeddings** endpoint, both OpenAI-compatible

### 2. Build the Airtable base

Create the 8 tables from `schema/schema.json`. Add a `Created` field of type **Created time** to every trigger table — the Airtable triggers fire off it and will not work without it. Details in [docs/01-airtable.md](docs/01-airtable.md).

### 3. Add the credentials

**Credentials → New**, one per service, named *exactly* as [docs/04-workflows.md](docs/04-workflows.md) lists them. The workflows reference credentials by name, so matching turns attaching them into one click.

### 4. Get the workflows in

Either build them by hand in the editor following [docs/04-workflows.md](docs/04-workflows.md) — the better exercise — or import `workflows/*.json` (**Workflows → Import from File**) and replace the placeholders that page tabulates: your base id, your Telegram chat id, two Drive folder ids, and the two model names.

### 5. Fill the vector store

Execute **WF6 Policies Embedding** and **WF7 Products Embedding** by hand, in that order, before activating the agents.
⚠️ n8n's Simple Vector Store is **in-memory**. Re-run both after every instance restart.

### 6. Try it

- Ask the **support bot**: *"מה מדיניות ההחזרות?"* or *"do you have wireless headphones?"*
- Ask the **manager bot**: *"what were earnings last month?"* or *"create a task to call supplier X"*
- Create an Invoice row in Airtable → validation runs → a PDF appears in Drive.

---

## Repo layout

```
schema/schema.json     ← single source of truth (8 tables). Everything reads this.
mock/policies/         ← policy and business-rule docs (*.md) for RAG — upload these to Drive
templates/             ← invoice / receipt / quote HTML (RTL Hebrew)
workflows/             ← importable n8n exports (placeholdered) + check.mjs
docs/                  ← step-by-step setup guides + canvas screenshots
```

Nothing here is deployed. The repo holds the schema, the content the workflows consume, the setup guides, and a reference export of each workflow — the *running* workflows live in n8n Cloud and nothing syncs back to this repo.

`node workflows/check.mjs` is the only runnable thing: it checks the exports for valid JSON, dangling connections and undocumented credential names, then runs WF1's validator against the VAT rules.

---

## The workflows

| # | Workflow | Trigger | Notes |
|---|----------|---------|-------|
| 1 | Tax-doc validation → file queue | new Invoice / TaxInvoice / Receipt | one shared `Validate` node |
| 3 | Contact intake + dedupe | new Lead | duplicates by email → `Dead` |
| 4a | Sales agent — cold emails | every 3 hours | ⚠️ sends real email |
| 4b | Sales agent — reply check | Gmail, unread, every 30 min | matches the thread back to a lead |
| 5 | Customer service agent | Telegram bot #2 | RAG over policies + catalogue |
| 6 | Policies → vector store | manual | Drive folder → chunks |
| 7 | Products → vector store | manual | Airtable rows → chunks |
| 8 | Document → PDF → Google Drive | every minute | Drive converts the HTML; no PDF service |
| 9 | Manager agent | Telegram bot #1 | owner-gated, 8 Airtable tools |

There is no WF2 — the numbering has a gap, not a missing file.

### How WF8 makes a PDF without a renderer

No Gotenberg, no PDF service, no binary. WF8 reads the source document out of Airtable, builds the HTML inline (the repo copies are in `templates/`), POSTs it to the Drive upload endpoint as `application/vnd.google-apps.document` so Drive converts it on the way in, exports that Doc back as a PDF, stores the PDF, and deletes the intermediate Doc. Both HTTP nodes reuse the existing `Drive OAuth` credential.

---

## Screenshots

Live n8n Cloud canvases.

### WF9 — Manager agent (Telegram bot #1)

Owner check → agent holding the policy vector store plus Airtable tools (`search_tasks`, `create_task`, `search_invoices` / `search_tax_invoices` / `search_receipts`, `Create_Invoice`, `Create_Tax_Invoice`, `Create_Receipt`). Anyone who is not the owner falls through to **Deny**. Issuing a document is gated behind an explicit confirmation from the owner.

![WF9 manager agent canvas](docs/screenshots/09-manager-agent.png)

The same workflow mid-run — green edges are the path one Telegram message actually took:

![WF9 manager agent, executed run](docs/screenshots/09-manager-agent-run.png)

### WF5 — Customer service agent (Telegram bot #2)

Telegram question → agent with two vector-store tools (policies, products) → Telegram answer. Grounded in RAG, so it answers from the documents and the catalogue rather than from the model's memory, and says so when the answer is not there.

![WF5 customer service agent canvas](docs/screenshots/05-customer-service.png)

### WF1 — Tax-document validation

Three Airtable triggers (Invoice / TaxInvoice / Receipt) feed one **Validate** code node: VAT rate against the issue date, VAT and total arithmetic, a business number on every tax invoice. Valid documents enter the file queue WF8 drains; invalid ones are marked on the record with the reason.

![WF1 tax-document validation canvas](docs/screenshots/01-tax-doc-validation.png)

### WF4a — Sales agent, cold emails

Every 3 hours: find leads with status `New` → write the email with the chat model → send via Gmail → mark the lead `Contacted`. ⚠️ This one sends real email.

![WF4a cold-email canvas](docs/screenshots/04a-sales-cold-emails.png)

### WF6 / WF7 — Embedding pipelines

Same shape twice: trigger → load the documents → embed → Simple Vector Store, one collection each (`policies`, `products`).

![Embedding pipeline with a text splitter](docs/screenshots/06-07-embedding-split.png)

![Embedding pipeline without a text splitter](docs/screenshots/06-07-embedding-plain.png)

### Airtable dashboard

The optional single-file `dashboard.html`: paste a base id and a personal access token and it reads the tables straight from the Airtable API. **Not in the repo** — it is gitignored, because a working copy holds a live token.

![Airtable dashboard](docs/screenshots/dashboard.png)

---

## Known limitations (deliberate, for simplicity)

- **Vector store and agent memory are in-memory.** Both are wiped on restart. Re-run WF6 and WF7; the agents answer "I don't know" until you do.
- **No local files.** n8n Cloud gives you no filesystem, so everything a workflow reads comes from Google Drive or is embedded in the workflow itself.
- **Airtable triggers poll at ≥1 minute** and fire off a `Created time` field — Airtable has no true "on create" event.
- **Sequential document numbering can race** when two documents are created inside the same poll window.
- **Google OAuth in "Testing" mode** expires refresh tokens after 7 days.
- **Relationships are string foreign keys** (`CUST-0001`), not Airtable links.
- **Two diagrams are out of date.** `docs/diagrams/06-policies-embedding.png` still draws a disk read and `08-file-pipeline.png` still draws Gotenberg; both predate the move to Cloud. [docs/04-workflows.md](docs/04-workflows.md) and the exports are correct.

Each of these is a decent next exercise: swap the Simple Vector Store for Qdrant or PGVector, move numbering behind a lock, publish the OAuth consent screen.

## Docs

1. [Airtable setup](docs/01-airtable.md) · 2. [Telegram bots](docs/02-telegram-bots.md) · 3. [Google OAuth](docs/03-google-oauth.md) · 4. [Building the workflows](docs/04-workflows.md)
