# 3. Google OAuth (Gmail + Drive)

Needed for the **sales agent** (sends/reads email) and the **file pipeline** (uploads invoice PDFs). One Google Cloud project covers both.

Self-hosted n8n means you bring your own Google OAuth client — there's no shared one.

## 1. Create a project + enable the APIs

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → **Create project** → name it `ai-erp`.
2. **APIs & Services → Library** → enable both:
   - **Gmail API**
   - **Google Drive API**

## 2. Configure the consent screen

**APIs & Services → OAuth consent screen**

- User type: **External**
- App name: `AI-ERP`, and fill in your email where required.
- **Test users** → add your own Google account. This matters: while the app is in *Testing*, only listed test users can authorise it.
- Save. You do **not** need to publish or get verified for personal use.

## 3. Create the OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Application type: **Web application**
- Name: `n8n`
- **Authorized redirect URIs** → add exactly:
  ```
  https://<your-instance>.app.n8n.cloud/rest/oauth2-credential/callback
  ```
  > Don't guess it: open the Gmail/Drive credential in n8n and copy the **OAuth Redirect URL** it displays. That value is always the authoritative one, and it must match here character for character.

Copy the **Client ID** and **Client secret**.

## 4. Add the credentials in n8n

Create **two** credentials in n8n — both use the same client id/secret:

| Name it exactly | Type |
|---|---|
| `Gmail OAuth` | Gmail OAuth2 API |
| `Drive OAuth` | Google Drive OAuth2 API |

For each: paste the client id + secret → click **Sign in with Google** → pick your test-user account → approve. Google will warn the app is unverified; choose **Advanced → Go to AI-ERP (unsafe)** — it's your own app.

## Which workflows use what

| Credential | Workflows |
|---|---|
| `Gmail OAuth` | WF3 (welcome email, optional), WF4a (cold emails), WF4b (reply check) |
| `Drive OAuth` | WF8 (upload invoice PDFs) |

## Gotchas

- **Refresh tokens expire after 7 days** while the consent screen is in *Testing* mode. When the agent suddenly can't send mail, re-authorise the credential (or publish the app).
- **Cold emails go to real inboxes.** The mock leads use plausible-but-fake addresses (`@gmail.com`, `@walla.co.il`) that may belong to real strangers. Before activating **WF4a**, either point the leads at addresses you control, or leave the workflow inactive and run it manually with a test lead. Don't spam people.
- Gmail sending limits apply (~500/day on a personal account) — irrelevant at this scale, but worth knowing.
