# 4. Building the workflows

Everything runs in **n8n Cloud** — <https://app.n8n.cloud>. There is nothing to install: your instance already has a public HTTPS URL, so Telegram bots and webhooks work with no tunnel.

`workflows/` holds an importable export of each one (**Workflows → Import from File**), and `docs/screenshots/` has the finished canvases to compare against. Building them by hand in the editor instead is the better exercise — the exports are there so you can diff your version against a working one, or get unstuck.

Every export is deactivated and carries placeholders you must replace:

| Placeholder | Where | Replace with |
|---|---|---|
| `appXXXXXXXXXXXXXX` | every Airtable node | your base id — [docs/01](01-airtable.md) |
| `REPLACE_WITH_OWNER_CHAT_ID` | WF9 `Is Owner?` | your own Telegram chat id — [docs/02](02-telegram-bots.md) |
| `REPLACE_WITH_POLICIES_FOLDER_ID` | WF6 `List Policy Files` | the Drive folder holding `mock/policies/*.md` |
| `REPLACE_WITH_DOCUMENTS_FOLDER_ID` | WF8 `Upload PDF` **and** the `FOLDER_ID` constant in WF8 `Build HTML` | the Drive folder the PDFs land in |
| `glm-5.2` / `baai/bge-m3` | chat and embeddings nodes | whatever your endpoints serve |

`node workflows/check.mjs` sanity-checks the exports: valid JSON, no dangling connections, only the credential names below, and WF1's validator still enforcing the VAT rules.

## Create the credentials first

Create these in n8n (**Credentials → New**) with **exactly these names** — the workflows reference them by name, so matching makes attaching a one-click job:

| Name | Type | Setup |
|---|---|---|
| `Airtable PAT` | Airtable Personal Access Token | [docs/01](01-airtable.md) |
| `Chat Model` | OpenAI API | your chat endpoint: Base URL + key |
| `Embeddings API` | OpenAI API | your embeddings endpoint: Base URL + key |
| `Telegram Manager Bot` | Telegram API | [docs/02](02-telegram-bots.md) |
| `Telegram Support Bot` | Telegram API | [docs/02](02-telegram-bots.md) |
| `Gmail OAuth` | Gmail OAuth2 | [docs/03](03-google-oauth.md) |
| `Drive OAuth` | Google Drive OAuth2 | [docs/03](03-google-oauth.md) |

> **Both LLM credentials are the "OpenAI API" type.** That's the trick that makes this work: any endpoint that speaks the OpenAI protocol can be used by n8n's OpenAI nodes once you override the **Base URL** field in the credential — the provider does not have to be OpenAI.

## No local files on Cloud

Your instance has no filesystem you control, so nothing reads from this repo at runtime. Two consequences:

- **Policy documents** (`mock/policies/*.md`) — upload them to a Google Drive folder. WF6 lists that folder with the Drive node, downloads each file, and embeds it.
- **Document templates** (`templates/*.html`) — the HTML lives inside WF8's `Build HTML` Code node. `templates/` stays in the repo as the readable reference version.

Same for the Airtable base id: type it into the Airtable nodes. Environment variables are not something you can rely on in a Cloud workspace.

> Two diagrams predate this: `docs/diagrams/06-policies-embedding.png` still shows a *Read Files From Disk* node and `08-file-pipeline.png` still shows *Gotenberg*. The exports follow this page — Drive in both cases.

## Wiring each workflow

1. **Attach credentials** — open any node showing a credential warning and pick the matching one.
2. **Pick your Airtable base/table** — select them from the dropdowns; they load once the Airtable credential is attached.
3. **Choose the model** — on chat nodes and `Embeddings` nodes, pick from the list the endpoint returns.
4. **Activate** the ones that should run on their own (schedules, Telegram, Gmail). The manual ones (WF6, WF7) you **Execute** by hand.

## Run them in this order

| Order | Workflow | Why |
|---|---|---|
| 1 | **WF6 — Policies Embedding** (manual) | fills the `policies` vector store |
| 2 | **WF7 — Products Embedding** (manual) | fills the `products` vector store |
| 3 | **WF5 / WF9** (activate) | the agents — they need the vector stores above |
| 4 | everything else | |

## ⚠️ Re-run WF6 and WF7 after every restart

n8n's **Simple Vector Store is in-memory**. Whenever the instance restarts, both collections are wiped and the agents lose all their knowledge (they'll answer "I don't know"). The agents' conversation memory resets too.

That's the trade-off for using the zero-setup built-in store. To make it persistent, swap the Simple Vector Store nodes for Qdrant/PGVector — a good next exercise.

## Which workflows need what

| Workflow | Credentials | Also needs |
|---|---|---|
| WF1 Tax-doc validation | Airtable | `Created` fields |
| WF3 Contact intake | Airtable (+ Gmail) | `Created` fields |
| WF4a Cold emails | Airtable, Gmail, Chat Model | ⚠️ sends real email — read [docs/03](03-google-oauth.md) |
| WF4b Reply check | Airtable, Gmail, Chat Model | — |
| WF5 Customer service | Telegram Support, Chat Model, Embeddings | WF6 + WF7 run first |
| WF6 Policies embedding | Drive, Embeddings | policy docs uploaded to a Drive folder |
| WF7 Products embedding | Airtable, Embeddings | — |
| WF8 Document → PDF → Drive | Airtable, Drive | `Files` rows with Status `Pending` |
| WF9 Manager agent | Telegram Manager, Chat Model, Airtable, Embeddings | your Telegram chat id in the owner check |

## How WF8 makes a PDF without a renderer

There is no Gotenberg and no PDF service. WF8 uses Google Drive itself:

The `Files` row only carries a `DocType` and a `SourceRecordId`, so an Airtable **Fetch Source Record** node reads the actual document out of `Invoices` / `TaxInvoices` / `Receipts` before `Build HTML` runs. Then:

1. **Create Google Doc** — POSTs the invoice HTML to the Drive upload endpoint with `mimeType: application/vnd.google-apps.document`. Drive converts the HTML into a Google Doc on the way in.
2. **Export PDF** — `GET /files/{id}/export?mimeType=application/pdf` returns the PDF as binary.
3. **Upload PDF** — stores that binary in Drive.
4. **Delete Temp Doc** — removes the intermediate Doc, leaving only the PDF.

Both HTTP nodes authenticate with the existing `Drive OAuth` credential (Predefined Credential Type → Google Drive OAuth2), so there is nothing extra to sign up for.

## Keeping the workflows

The **live n8n instance is the source of truth** once you start editing. `workflows/` is a reference copy, not a deployment — nothing syncs it back.

To back one up, open it → ⋯ menu → **Download**. Review before committing: an export carries node parameters, and it is easy to leak a chat id, a base id or an endpoint URL that way. The exports in `workflows/` are placeholdered for exactly that reason.
