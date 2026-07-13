export function normalizePurchaseName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
