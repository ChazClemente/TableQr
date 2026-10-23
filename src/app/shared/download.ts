/** Triggers a browser download of an in-memory file. */
export function downloadFile(content: string, filename: string, type = 'text/html') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** The simple customer-facing HTML receipt used by OrderStatus and Payment. */
export function customerReceiptHtml(opts: {
  title: string;
  meta: [string, string][];
  rows: { name: string; quantity: number; amount: number }[];
  total: number;
}) {
  const rows = opts.rows.map(r =>
    `<tr><td style="padding:4px 8px">${r.name}</td><td style="padding:4px 8px;text-align:center">${r.quantity}</td><td style="padding:4px 8px;text-align:right">₱${r.amount.toLocaleString()}</td></tr>`
  ).join('');
  const meta = opts.meta.map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${opts.title}</title>
<style>body{font-family:'Georgia',serif;max-width:320px;margin:40px auto;color:#2C1810;background:#FFF8EE;padding:24px}
h1{font-size:18px;margin:0}p{margin:4px 0;font-size:12px;color:#9B7B5A}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
thead tr{border-bottom:1px solid #C4A882}th{padding:4px 8px;text-align:left;font-size:11px;letter-spacing:.08em;color:#9B7B5A}
tfoot td{border-top:1px solid #C4A882;font-weight:bold;font-size:15px;padding:8px}
.center{text-align:center}.muted{color:#9B7B5A;font-size:11px;font-style:italic}
</style></head><body>
<div class="center"><h1>Kainan Kay Aling Nene</h1><p>Authentic Filipino Kitchen</p><hr style="border-color:#C4A882;margin:12px 0"></div>
${meta}
<p><strong>Date:</strong> ${new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
<table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="2">Total</td><td style="text-align:right">₱${opts.total.toLocaleString()}</td></tr></tfoot></table>
<div class="center"><p class="muted">Salamat at bumalik po kayo!</p><p class="muted">This is your official receipt.</p></div>
</body></html>`;
}