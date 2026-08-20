// Formats the sequential Order.orderNumber into the customer-facing order
// reference shown in the UI and emails (e.g. 42 -> "ALP-000042"), instead of
// exposing the internal cuid primary key.
export function formatOrderNumber(orderNumber: number): string {
  return `ALP-${String(orderNumber).padStart(6, "0")}`;
}
