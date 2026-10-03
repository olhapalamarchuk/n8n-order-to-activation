// Error workflow, Code node "Build fallback task" (Run Once for All Items)
const e = $json;
return [{ json: {
  order_id: 'unknown – see execution',
  channel: 'email',
  recipient: 'cloud-ops@nimbus-cloud.example',
  subject: `[MANUAL FALLBACK] ${e.workflow?.name} failed at "${e.execution?.lastNodeExecuted}"`,
  body: `Error: ${e.execution?.error?.message}\nExecution: ${e.execution?.url}\n\nPlease complete this activation manually using the runbook and update the order status.`,
  created_at: new Date().toISOString(),
} }];
