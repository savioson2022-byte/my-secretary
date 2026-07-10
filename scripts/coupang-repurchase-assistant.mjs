import { spawn } from "node:child_process";

const ALLOWED_HOSTS = new Set([
  "www.coupang.com",
  "m.coupang.com",
  "link.coupang.com",
]);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith("--")) continue;

    const key = value.slice(2);
    const nextValue = argv[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = nextValue;
    index += 1;
  }

  return args;
}

function createCoupangSearchUrl(productName) {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(
    productName
  )}`;
}

function assertSafeUrl(urlText) {
  const url = new URL(urlText);

  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("쿠팡 HTTPS URL만 열 수 있습니다.");
  }

  return url.toString();
}

function openUrl(url) {
  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}

const args = parseArgs(process.argv.slice(2));
const productName = String(args.product ?? "").trim();
const urlText = String(args.url ?? "").trim();
const maxBudget = args["max-budget"] ? Number(args["max-budget"]) : null;
const quantity = args.quantity ? Number(args.quantity) : null;
const confirmed = args.confirm === true || args.confirm === "true";

if (!productName && !urlText) {
  console.error(
    "상품명 또는 쿠팡 URL이 필요합니다. 예: npm run purchase:coupang -- --product 물티슈 --confirm"
  );
  process.exit(1);
}

if (!confirmed) {
  console.error(
    "--confirm을 붙여야 실행됩니다. 이 스크립트는 쿠팡 페이지를 열 뿐, 결제 버튼을 대신 누르지 않습니다."
  );
  process.exit(1);
}

const targetUrl = assertSafeUrl(urlText || createCoupangSearchUrl(productName));

console.log("쿠팡 재구매 보조를 시작합니다.");
console.log(`상품: ${productName || "URL 직접 지정"}`);
if (quantity && Number.isFinite(quantity)) {
  console.log(`기본 수량: ${quantity}`);
}
if (maxBudget && Number.isFinite(maxBudget)) {
  console.log(`예산 상한: ${maxBudget.toLocaleString("ko-KR")}원`);
}
console.log("비밀번호, 결제수단, 쿠팡 세션은 이 앱에 저장하지 않습니다.");
console.log("결제 직전 상품명, 가격, 배송지, 수량을 직접 확인하세요.");
console.log(`열기: ${targetUrl}`);

openUrl(targetUrl);
