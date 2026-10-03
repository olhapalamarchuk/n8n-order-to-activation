// n8n Code node "Validate order" (Mode: Run Once for All Items, Language: JavaScript)
// Input: output of the "AI Extract Order" chain. Form data is read from the Form Trigger node.
const form = $('On form submission').first().json;
const ai = $input.first().json.output;
const orderId = $('Create order ID').first().json.order_id;

const errors = [];
const warnings = [];

// 1. Rules the business owns (in a real setup: a config table)
const REGION_ACCOUNTS = {
  'EU': 'cloud-eu@nimbus-cloud.example',
  'US': 'cloud-us@nimbus-cloud.example',
  'APAC-AU': 'cloud-au@nimbus-cloud.example',   // Australian customers use a separate account
  'APAC-SG': 'cloud-sg@nimbus-cloud.example',
};
const ENV_CODES = { production: 'PRD', staging: 'STG', development: 'DEV', uat: 'UAT', test: 'TST' };
const MAX_NAME = 60;   // subscription name length limit

// 2. Completeness (AI result + hard check, the code does not trust the AI alone)
const required = ['customer_name', 'region', 'product', 'dr_type', 'contract_start'];
for (const f of required) {
  if (!ai[f] || ai[f] === 'not_specified') errors.push(`Missing in contract: ${f}`);
}
for (const f of (ai.missing_fields || [])) {
  if (!errors.some(e => e.endsWith(f))) errors.push(`Missing in contract: ${f}`);
}
if (!ai.signed_by_customer) errors.push('Contract is not signed by the customer');

// 3. Consistency between what Sales entered and what the contract says
if (ai.region && ai.region !== 'not_specified' && ai.region !== form['Region']) {
  errors.push(`Region mismatch: form says ${form['Region']}, contract says ${ai.region}`);
}
if (ai.dr_type && ai.dr_type !== 'not_specified' && ai.dr_type !== form['DR type']) {
  errors.push(`DR type mismatch: form says ${form['DR type']}, contract says ${ai.dr_type}`);
}

// 4. Environment rules (standard activation = 2 to 3 environments)
const envs = ai.environments || [];
if (envs.length === 0) errors.push('No environments found in contract');
else if (envs.length < 2 || envs.length > 3) {
  warnings.push(`Non-standard number of environments (${envs.length}); approver must confirm`);
}

// 5. AI flags: uncertainty and suspicious content go to the approver, never block silently
for (const f of (ai.uncertain_fields || [])) warnings.push(`AI is uncertain about: ${f}`);
for (const s of (ai.suspicious_content || [])) warnings.push(`Suspicious content in contract: ${s}`);

// 6. Account by region
const region = form['Region'];
const account = REGION_ACCOUNTS[region];
if (!account) errors.push(`No cloud account configured for region ${region}`);

// 7. Subscription names, max 60 characters
const shortId = orderId.slice(-8).toLowerCase();
const legal = /\b(GmbH|AG|Pty Ltd|Pty|Ltd|Inc\.?|LLC|B\.V\.|BV|S\.A\.|SE|plc)\s*$/i;
let base = (ai.customer_name || form['Customer name'] || '').trim();
while (legal.test(base)) base = base.replace(legal, '').trim().replace(/[,]$/, '');

const subscriptions = envs.map(e => {
  const key = e.toLowerCase();
  const code = Object.entries(ENV_CODES).find(([k]) => key.includes(k))?.[1] || 'ENV';
  const fixed = `Nimbus Cloud -  ${code} - ${shortId}`;          // parts that must stay
  const room = MAX_NAME - fixed.length;
  let cust = base;
  if (base.length > room) {                                     // cut at a whole word
    const cut = base.slice(0, room + 1);
    cust = cut.includes(' ') ? cut.slice(0, cut.lastIndexOf(' ')) : base.slice(0, room);
  }
  const name = `Nimbus Cloud - ${cust} ${code} - ${shortId}`;
  return { environment: e, env_code: code, subscription_name: name, name_length: name.length, shortened: cust !== base };
});
if (subscriptions.some(s => s.shortened)) warnings.push('Customer name shortened to keep subscription names within 60 characters');

return [{
  json: {
    order_id: orderId,
    valid: errors.length === 0,
    errors,
    warnings,
    customer_name: ai.customer_name,
    customer_contact: ai.customer_contact_email,
    sales_email: form['Sales rep email'],
    region,
    account,
    product: ai.product,
    dr_type: ai.dr_type,
    contract_start: ai.contract_start,
    term_months: ai.term_months,
    environments: envs,
    subscriptions,
    summary_for_ops: ai.summary_for_ops,
    errors_text: errors.join('; '),
    warnings_text: warnings.join('; '),
  }
}];
