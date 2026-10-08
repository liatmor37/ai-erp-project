# 1. Airtable setup

The Airtable base is the database. You build the 8 tables yourself from `schema/schema.json`, then add the `Created` trigger fields.

## Create the base

1. Go to [airtable.com](https://airtable.com) and create a new **empty base**. Call it `AI-ERP`.
2. Open it and copy the **base id** from the URL — it's the part starting with `app`:
   `https://airtable.com/`**`appXXXXXXXXXXXXXX`**`/tblYYY/viwZZZ`
3. Keep it handy — the Airtable nodes in n8n need it.

You'll build your own tables, so the default `Table 1` can be renamed or deleted.

## Create a Personal Access Token (PAT)

1. Go to <https://airtable.com/create/tokens> → **Create new token**.
2. Name: `AI-ERP`.
3. **Scopes** — add all four:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
   - `schema.bases:write`
4. **Access** → add the `AI-ERP` base.
5. Copy the token (starts with `pat...`) straight into the **Airtable PAT** credential in n8n. You only see it once.

## Build the tables

Create the 8 tables in the base by hand (or with a script of your own), following `schema/schema.json` — it lists every table, field name, and field type. Field types map to Airtable directly: `text`, `email`, `phone`, `url`, `int`, `currency`, `percent`, `date`, `datetime`, `checkbox`, `select` (with `choices`), and `created` (the "Created time" field below). The first field in each table is the primary field.

Populate records as you build the project — the base ships empty.

## ⚠️ Add the `Created` fields by hand

Airtable's API **cannot create "Created time" fields** — they're read-only/computed. The n8n Airtable Triggers need one to detect new records, so add it manually:

For each of these tables — **Customers, Leads, Products, Invoices, TaxInvoices, Receipts**:

1. Open the table → click **＋** at the right end of the field row.
2. Choose field type **Created time**.
3. Name it exactly **`Created`**.

That's it — 6 tables, one click each. (Tasks and Files have a `Created` column in the schema too, but nothing triggers off them, so it's optional there.)

## Notes

- **Relationships are plain text ids**, not Airtable links: `Invoices.CustomerId` holds `"CUST-0012"`.
- **`VATRate` is a percent field**, stored as a fraction: `0.18` displays as `18%`.
- **`LineItems` / `Items` are JSON strings** — a compact way to keep line items without extra tables.
- Airtable's free plan allows **5 requests/second per base**; pace any bulk writes you script.
