# 2. Telegram bots

You need **two separate bots**:

| Bot | Who talks to it | Workflow |
|---|---|---|
| **Manager bot** | you, the business owner | WF9 |
| **Support bot** | your customers | WF5 |

Two bots so customers can never reach the manager agent (which can read revenue, expenses and salaries).

## Create them

In Telegram, message [@BotFather](https://t.me/BotFather):

1. Send `/newbot`
2. Name: `AI Electronics Manager` → username: something ending in `bot`, e.g. `ai_erp_manager_bot`
3. BotFather replies with a token like `8123456789:AAF...`. Keep it for the **Telegram Manager Bot** credential in n8n.
4. Repeat `/newbot` for the support bot → the **Telegram Support Bot** credential.

## Find your own chat id

The manager agent (WF9) only answers **you** — it checks the incoming chat id against your own. Anyone else gets "this bot is for the manager only".

Easiest way:

1. Send any message to your **manager bot** (e.g. `hi`).
2. Open this in a browser, with your manager token:
   `https://api.telegram.org/bot<YOUR_MANAGER_TOKEN>/getUpdates`
3. Find `"chat":{"id":123456789,...}` — that number is yours.
4. Put that number in the owner check inside WF9.

(Or message [@userinfobot](https://t.me/userinfobot), which just tells you your id.)

## Webhooks just work

Telegram triggers are **webhook-based** — Telegram has to reach n8n over public HTTPS. On n8n Cloud your instance already has a public HTTPS URL, so there is nothing to tunnel or forward: activate the workflow and n8n registers the webhook with Telegram for you.

⚠️ A Telegram trigger only registers its webhook while the workflow is **active**. In the editor, use **Execute workflow** and send a message to test.

## Add the credentials in n8n

In n8n → **Credentials** → **New** → *Telegram API*, twice:

| Name it exactly | Token |
|---|---|
| `Telegram Manager Bot` | your manager token |
| `Telegram Support Bot` | your support token |

Matching these names makes attaching them to the imported nodes a single click.

## Try it

Activate **WF5 — Customer Service Agent**, then message the support bot:

- `מה מדיניות ההחזרות שלכם?`
- `Do you have wireless headphones under 1000?`

If it answers "I don't know" about everything, the vector store is empty — run **WF6** and **WF7** first.
