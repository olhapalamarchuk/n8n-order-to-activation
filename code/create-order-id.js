// n8n Code node "Create order ID" (Run Once for All Items)
const d = new Date();
const date = d.toISOString().slice(0, 10).replace(/-/g, '');
const rand = Array.from({ length: 8 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('');
return [{ json: { order_id: `ORD-${date}-${rand}`, received_at: d.toISOString() } }];
