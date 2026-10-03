// n8n Code node "One item per subscription" (Run Once for All Items)
const o = $('Validate order').first().json;
const formName = $('On form submission').first().json['Customer name'];
return o.subscriptions.map(s => ({ json: {
  order_id: o.order_id,
  customer_name: o.customer_name,
  form_customer_name: formName,   // used only by the failure test hook
  account: o.account,
  region: o.region,
  environment: s.environment,
  env_code: s.env_code,
  subscription_name: s.subscription_name,
} }));
