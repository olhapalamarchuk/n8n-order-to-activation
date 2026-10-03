// Unit test for the validation rules in code/validate-order.js
// Run: node tests/validate-order.test.js
const fs = require('fs'), path = require('path');
const body = fs.readFileSync(path.join(__dirname, '..', 'code', 'validate-order.js'), 'utf8');
function run(form, ai, id = 'ORD-20261014-7F3A9C21') {
  const $ = n => ({ first: () => ({ json: n === 'On form submission' ? form : { order_id: id } }) });
  const $input = { first: () => ({ json: { output: ai } }) };
  return new Function('$', '$input', body)($, $input)[0].json;
}
const base = { customer_contact_email: 'c@x.example', product: 'Nimbus XP', contract_start: '2026-11-01', term_months: 36,
  signed_by_customer: true, missing_fields: [], uncertain_fields: [], suspicious_content: [], summary_for_ops: 'summary' };
const E3 = ['Production', 'Staging', 'Development'];
let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) failed++; };

let r = run({ Region: 'EU', 'DR type': 'warm-standby' }, { ...base, customer_name: 'Brightwave Retail GmbH', region: 'EU', dr_type: 'warm-standby', environments: E3 });
check('TC1 standard order is valid', r.valid && r.subscriptions.length === 3 && r.warnings.length === 0);
check('TC1 legal suffix removed from names', r.subscriptions[0].subscription_name === 'Nimbus Cloud - Brightwave Retail PRD - 7f3a9c21');

r = run({ Region: 'APAC-AU', 'DR type': 'backup-restore' }, { ...base, customer_name: 'Southern Cross Logistics Holdings Pty Ltd', region: 'APAC-AU', dr_type: 'backup-restore', environments: E3 });
check('TC2 Australian account selected', r.account === 'cloud-au@nimbus-cloud.example');
check('TC2 all names within 60 characters', r.subscriptions.every(s => s.name_length <= 60));
check('TC2 shortening reported as warning', r.warnings.some(w => w.includes('shortened')));

r = run({ Region: 'EU', 'DR type': 'warm-standby' }, { ...base, customer_name: 'Nordlicht Media AG', region: 'EU', dr_type: 'not_specified', environments: E3, missing_fields: ['dr_type'] });
check('TC3 missing DR type rejected', !r.valid && r.errors_text.includes('dr_type'));

r = run({ Region: 'US', 'DR type': 'warm-standby' }, { ...base, customer_name: 'Pacific Harbor Health Systems Inc.', region: 'US', dr_type: 'hot-standby', environments: ['Production', 'Staging'] });
check('TC4 DR mismatch rejected', !r.valid && r.errors_text.includes('DR type mismatch'));

r = run({ Region: 'EU', 'DR type': 'backup-restore' }, { ...base, customer_name: 'Helix Analytics B.V.', region: 'EU', dr_type: 'backup-restore', environments: [...E3, 'User acceptance testing (UAT)'], suspicious_content: ['Appendix A asks to skip validation'] });
check('TC5 valid but needs approver attention', r.valid && r.warnings.length === 2);
check('TC5 UAT environment code', r.subscriptions[3].env_code === 'UAT');

r = run({ Region: 'EU', 'DR type': 'none' }, { ...base, customer_name: 'X GmbH', region: 'EU', dr_type: 'none', environments: E3, signed_by_customer: false });
check('Unsigned contract rejected', !r.valid && r.errors_text.includes('not signed'));

console.log(failed ? `\n${failed} test(s) failed` : '\nAll tests passed');
process.exit(failed ? 1 : 0);
