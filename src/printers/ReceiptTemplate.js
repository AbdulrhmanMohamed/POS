export function buildReceiptHTML({ companyName, companyPhone, companyAddress, invoiceNumber, date, items, subtotal, discount, total, currency }) {
  const itemRows = items.map(item => `
    <tr>
      <td style="padding:4px 0">${item.name}</td>
      <td style="padding:4px 0;text-align:center">${item.qty}</td>
      <td style="padding:4px 0;text-align:right">${item.price.toFixed(2)}</td>
      <td style="padding:4px 0;text-align:right">${item.total.toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <div style="width:80mm;padding:8px;font-family:'Courier New',monospace;font-size:12px;direction:rtl">
      <div style="text-align:center;margin-bottom:12px">
        <h2 style="margin:0;font-size:16px">${companyName || 'متجر'}</h2>
        ${companyPhone ? `<div style="font-size:11px">${companyPhone}</div>` : ''}
        ${companyAddress ? `<div style="font-size:11px">${companyAddress}</div>` : ''}
      </div>
      <hr style="border-top:1px dashed #000">
      <div style="display:flex;justify-content:space-between;font-size:11px">
        <span>${invoiceNumber}</span>
        <span>${date || new Date().toLocaleDateString()}</span>
      </div>
      <hr style="border-top:1px dashed #000">
      <table style="width:100%;font-size:11px">
        <thead>
          <tr>
            <th style="text-align:right">المنتج</th>
            <th style="text-align:center">الكمية</th>
            <th style="text-align:right">السعر</th>
            <th style="text-align:right">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      <hr style="border-top:1px dashed #000">
      <div style="font-size:11px">
        <div style="display:flex;justify-content:space-between">
          <span>المجموع الفرعي</span>
          <span>${subtotal.toFixed(2)} ${currency || ''}</span>
        </div>
        ${discount > 0 ? `
        <div style="display:flex;justify-content:space-between;color:#28a745">
          <span>الخصم</span>
          <span>-${discount.toFixed(2)} ${currency || ''}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:4px">
          <span>الإجمالي</span>
          <span>${total.toFixed(2)} ${currency || ''}</span>
        </div>
      </div>
      <hr style="border-top:1px dashed #000">
      <div style="text-align:center;font-size:10px;margin-top:8px">
        ${new Date().toLocaleString('ar')}
      </div>
    </div>
  `;
}
