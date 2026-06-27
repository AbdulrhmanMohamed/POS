export const ProductSchema = {
  name: { type: 'string', required: true, maxLength: 255 },
  barcode: { type: 'barcode', required: false },
  price: { type: 'number', required: true, default: 0 },
  cost: { type: 'number', default: 0 },
  stock: { type: 'integer', default: 0 },
  min_stock: { type: 'integer', default: 0 },
  category: { type: 'string', maxLength: 100 },
  unit: { type: 'string', maxLength: 50 },
  image: { type: 'string', maxLength: 500 },
};

export const CustomerSchema = {
  name: { type: 'string', required: true, maxLength: 255 },
  phone: { type: 'phone' },
  email: { type: 'email' },
  address: { type: 'string', maxLength: 500 },
  balance: { type: 'number', default: 0 },
  credit_limit: { type: 'number', default: 0 },
  notes: { type: 'string', maxLength: 1000 },
};

export const SupplierSchema = {
  name: { type: 'string', required: true, maxLength: 255 },
  phone: { type: 'phone' },
  email: { type: 'email' },
  address: { type: 'string', maxLength: 500 },
  balance: { type: 'number', default: 0 },
  notes: { type: 'string', maxLength: 1000 },
};

export const InvoiceSchema = {
  customer_id: { type: 'integer' },
  subtotal: { type: 'number', required: true },
  discount: { type: 'number', default: 0 },
  total: { type: 'number', required: true },
  paid: { type: 'number', default: 0 },
  due: { type: 'number', default: 0 },
  status: { type: 'string', maxLength: 50 },
  notes: { type: 'string', maxLength: 1000 },
};

export const InvoiceItemSchema = {
  invoice_id: { type: 'integer', required: true },
  product_id: { type: 'integer', required: true },
  product_name: { type: 'string', required: true, maxLength: 255 },
  barcode: { type: 'barcode' },
  quantity: { type: 'integer', required: true },
  unit_price: { type: 'number', required: true },
  total_price: { type: 'number', required: true },
};

export const InventorySchema = {
  product_id: { type: 'integer', required: true },
  type: { type: 'string', required: true, maxLength: 50 },
  quantity: { type: 'integer', required: true },
  balance_before: { type: 'integer', required: true },
  balance_after: { type: 'integer', required: true },
  notes: { type: 'string', maxLength: 500 },
};

export const AuditLogSchema = {
  user_id: { type: 'integer' },
  action: { type: 'string', required: true, maxLength: 100 },
  entity_type: { type: 'string', required: true, maxLength: 50 },
  entity_id: { type: 'integer' },
  old_value: { type: 'string' },
  new_value: { type: 'string' },
};

export const SettingsSchema = {
  key: { type: 'string', required: true, maxLength: 100 },
  value: { type: 'string', maxLength: 1000 },
};

export const PurchaseOrderSchema = {
  po_number: { type: 'string', required: true, maxLength: 50 },
  supplier_id: { type: 'integer', required: true },
  order_date: { type: 'string', required: true, maxLength: 20 },
  expected_date: { type: 'string', maxLength: 20 },
  status: { type: 'string', maxLength: 20, default: 'pending' },
  total: { type: 'number', default: 0 },
  notes: { type: 'string', maxLength: 1000 },
};

export const PurchaseOrderItemSchema = {
  purchase_order_id: { type: 'integer', required: true },
  product_id: { type: 'integer', required: true },
  product_name: { type: 'string', required: true },
  quantity: { type: 'integer', required: true },
  unit_price: { type: 'number', required: true },
  total_price: { type: 'number', required: true },
};

export const ReturnSchema = {
  return_number: { type: 'string', required: true, maxLength: 50 },
  invoice_id: { type: 'integer', required: true },
  customer_id: { type: 'integer' },
  total: { type: 'number', required: true },
  reason: { type: 'string', maxLength: 500 },
  status: { type: 'string', maxLength: 20, default: 'completed' },
};

export const ReturnItemSchema = {
  return_id: { type: 'integer', required: true },
  product_id: { type: 'integer', required: true },
  quantity: { type: 'integer', required: true },
  unit_price: { type: 'number', required: true },
  total: { type: 'number', required: true },
};
