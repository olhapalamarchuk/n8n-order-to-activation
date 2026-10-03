// n8n Code node "Build approval request" (Run Once for All Items)
// Runs right before the Wait node, so $execution.resumeFormUrl is the approval form link.
const o = $('Validate order').first().json;
const lines = [
  `Order ${o.order_id} for ${o.customer_name} is ready for activation.`,
  ``,
  `AI summary: ${o.summary_for_ops}`,
  `Region / account: ${o.region} / ${o.account}`,
  `Product: ${o.product}`,
  `DR type: ${o.dr_type}`,
  `Start: ${o.contract_start}, term ${o.term_months} months`,
  `Subscriptions to create:`,
  ...o.subscriptions.map(s => `  - ${s.subscription_name} (${s.name_length} chars)`),
  ``,
  o.warnings.length ? `CHECK BEFORE APPROVING: ${o.warnings_text}` : `No warnings.`,
  ``,
  `Approve or reject here: ${$execution.resumeFormUrl}`,
];
return [{ json: {
  order_id: o.order_id,
  channel: 'email',
  recipient: 'cloud-ops@nimbus-cloud.example',
  subject: `[Approval needed] ${o.customer_name} – ${o.order_id}`,
  body: lines.join('\n'),
  created_at: new Date().toISOString(),
} }];
