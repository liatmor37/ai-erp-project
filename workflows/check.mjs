// Smallest check that fails if the exports rot: every file is valid JSON with a
// sane node graph and only the documented credential names, and WF1's validator
// actually enforces the Israeli VAT rules.
//
//   node workflows/check.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
assert.equal(files.length, 9, `expected 9 workflow exports, found ${files.length}`);

// Exactly the names in docs/04-workflows.md.
const CREDENTIALS = new Set([
  'Airtable PAT', 'Chat Model', 'Embeddings API',
  'Telegram Manager Bot', 'Telegram Support Bot', 'Gmail OAuth', 'Drive OAuth'
]);

const workflows = {};
for (const file of files) {
  const wf = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  workflows[file] = wf;

  const names = wf.nodes.map((n) => n.name);
  assert.equal(new Set(names).size, names.length, `${file}: duplicate node names`);
  assert.ok(names.some((n) => wf.nodes.find((x) => x.name === n).type.toLowerCase().includes('trigger')),
    `${file}: no trigger node`);

  for (const [from, outputs] of Object.entries(wf.connections)) {
    assert.ok(names.includes(from), `${file}: connection from unknown node ${from}`);
    for (const branches of Object.values(outputs)) {
      for (const targets of branches) {
        for (const t of targets || []) {
          assert.ok(names.includes(t.node), `${file}: ${from} connects to unknown node ${t.node}`);
        }
      }
    }
  }

  for (const node of wf.nodes) {
    for (const cred of Object.values(node.credentials || {})) {
      assert.ok(CREDENTIALS.has(cred.name), `${file}: ${node.name} uses undocumented credential "${cred.name}"`);
    }
  }
}

// --- WF1 Validate -----------------------------------------------------------
const validateCode = workflows['01-tax-doc-validation.json'].nodes
  .find((n) => n.name === 'Validate').parameters.jsCode;

function runValidate(triggerName, rows) {
  const items = rows.map((json) => ({ json }));
  const $input = { all: () => items };
  const $ = (name) => {
    if (name !== triggerName) throw new Error(`${name} did not run`);
    return { all: () => items };
  };
  // eslint-disable-next-line no-new-func
  return new Function('$input', '$', validateCode)($input, $).map((i) => i.json);
}

const invoice = {
  id: 'rec1', DocNumber: 7, CustomerId: 'CUST-0001', IssueDate: '2026-03-01',
  Subtotal: 1000, VATRate: 0.18, VATAmount: 180, Total: 1180
};

let [r] = runValidate('New Invoice', [invoice]);
assert.equal(r.valid, true, `a correct 18% invoice must pass, got: ${r.error}`);
assert.equal(r.docType, 'Invoice');
assert.equal(r.year, '2026');
assert.equal(r.month, '03');

[r] = runValidate('New Invoice', [{ ...invoice, VATRate: 0.17, VATAmount: 170, Total: 1170 }]);
assert.equal(r.valid, false, '17% VAT after 2025-01-01 must fail');
assert.match(r.error, /VATRate/);

[r] = runValidate('New Invoice', [{
  ...invoice, IssueDate: '2024-06-01', VATRate: 0.17, VATAmount: 170, Total: 1170
}]);
assert.equal(r.valid, true, `17% VAT before 2025-01-01 must pass, got: ${r.error}`);

[r] = runValidate('New Invoice', [{ ...invoice, Total: 1200 }]);
assert.equal(r.valid, false, 'Total that is not Subtotal + VAT must fail');

[r] = runValidate('New Invoice', [{ ...invoice, DocNumber: 0 }]);
assert.equal(r.valid, false, 'DocNumber 0 must fail');

[r] = runValidate('New TaxInvoice', [{ ...invoice, TaxInvoiceId: 'TAX-1' }]);
assert.equal(r.valid, false, 'a tax invoice without a business number must fail');
assert.match(r.error, /business number/);

[r] = runValidate('New TaxInvoice', [{ ...invoice, TaxInvoiceId: 'TAX-1', CustomerBusinessNumber: '515678923' }]);
assert.equal(r.valid, true, `a complete tax invoice must pass, got: ${r.error}`);

[r] = runValidate('New Receipt', [{
  id: 'rec9', DocNumber: 3, CustomerId: 'CUST-0001', IssueDate: '2026-03-01', Amount: 0, PaymentMethod: 'Cash'
}]);
assert.equal(r.valid, false, 'a receipt for 0 must fail');
assert.equal(r.docType, 'Receipt');

[r] = runValidate('New Receipt', [{
  id: 'rec9', DocNumber: 3, CustomerId: 'CUST-0001', IssueDate: '2026-03-01', Amount: 1180, PaymentMethod: 'Bit'
}]);
assert.equal(r.valid, true, `a correct receipt must pass, got: ${r.error}`);

console.log(`ok — ${files.length} workflows, WF1 validator enforces the VAT rules`);
