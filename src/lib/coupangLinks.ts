export function createCoupangSearchUrl(productName: string) {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(
    productName
  )}`;
}
