// n8n Code node "Build notifications" (Run Once for All Items)
// Names come from "One item per subscription" (always complete),
// GUIDs from the sub-workflow results.
const o = $('Validate order').first().json;
const approval = $('Wait for Cloud Ops approval').first().json;

const planned = $('One item per subscription').all().map(i => i.json);
const created = $input.all().map(i => i.json);
const subs = planned.map((p, k) => ({
  environment: p.environment,
  subscription_name: p.subscription_name,
  subscription_guid: (created[k] && created[k].subscription_guid) || 'see subscriptions table',
}));

const list = subs.map(s => `  - ${s.environment}: ${s.subscription_name} (${s.subscription_guid})`).join('\n');
const now = new Date().toISOString();
const n = (recipient, subject, body) => ({ json: { order_id: o.order_id, channel: 'email', recipient, subject, body, created_at: now } });

return [
  n(o.customer_contact || 'customer@unknown.example', `Welcome to Nimbus Cloud, ${o.customer_name}`,
    `Your Managed Cloud contract has been activated.\n\nYour environments:\n${list}\n\nYou can now request provisioning of your application sets.`),
  n('global-billing@nimbus-cloud.example', `[Activated] ${o.customer_name} – ${o.order_id}`,
    `Billing agreement created. DR type: ${o.dr_type}. Start: ${o.contract_start}. Subscriptions:\n${list}`),
  n(o.sales_email, `[Activated] Your order for ${o.customer_name}`,
    `Order ${o.order_id} was approved by ${approval['Approver name']} and activated. The customer has received the welcome email.`),
  n('order-processing@nimbus-cloud.example', `[Activated] ${o.order_id}`,
    `Order ${o.order_id} is activated. No manual action needed.`),
];
