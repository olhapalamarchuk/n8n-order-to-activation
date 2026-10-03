// Sub-workflow "Create subscription", Code node "Simulate cloud API" (Run Once for Each Item)
// Replaces the regional PowerShell scripts / pipelines with one reusable step.
// In production this would be an HTTP Request node to the cloud provider API.
const i = $json;
if (!i.subscription_name || i.subscription_name.length > 60) {
  throw new Error(`Invalid subscription name: "${i.subscription_name}"`);
}
// Test hook: a customer name containing "FAILTEST" in the form simulates a cloud API outage
if ((i.form_customer_name || '').includes('FAILTEST')) {
  throw new Error('Cloud API timeout while creating subscription (simulated)');
}
const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
const guid = `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
return { json: {
  order_id: i.order_id,
  subscription_name: i.subscription_name,
  subscription_guid: guid,
  environment: i.environment,
  account: i.account,
  status: 'created',
  created_at: new Date().toISOString(),
} };
