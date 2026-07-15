export type MailImportCandidate = {
  id: string;
  productName: string;
  productUrl: string;
  priceText: string | null;
  quantityText: string | null;
  orderDateText: string | null;
  confidence: "low" | "medium" | "high";
  reason: string;
};

export type PurchaseMailImportResult = {
  candidates: MailImportCandidate[];
  source: "ai" | "fallback";
};

function cleanImportedLine(line: string) {
  return line
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeProductLine(line: string) {
  if (line.length < 4 || line.length > 160) return false;

  const blockedPatterns = [
    /주문(이|을|번호|내역|완료|확인)/,
    /결제|배송|도착|출고|취소|반품|교환|영수증/,
    /쿠팡|Coupang|고객센터|수신거부|개인정보/,
    /검색|메일|답장|전달|삭제|이동|목록|보기|열기|닫기|뒤로|앞으로/,
    /네이버|NAVER|Naver|받은메일함|보낸메일함|스팸메일함/,
    /전체|결과|상세|필터|정렬|설정|로그인|비회원/,
    /총\s?상품|총\s?결제|합계|할인|배송비/,
    /결제금액|결제수단|승인번호|카드|현금영수증/,
    /https?:\/\//,
    /^\d+\s?개$/,
    /^[\d\s,원\-:.]+$/,
  ];

  if (blockedPatterns.some((pattern) => pattern.test(line))) return false;

  return /[가-힣A-Za-z]/.test(line);
}

function getPriceText(line: string) {
  return line.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s?원/)?.[0] ?? null;
}

function getQuantityText(line: string) {
  return line.match(/([0-9]+)\s?개/)?.[0] ?? null;
}

function removePurchaseMeta(line: string) {
  return cleanImportedLine(
    line
      .replace(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s?원/g, "")
      .replace(/[0-9]+\s?개/g, "")
      .replace(/상품명|상품정보|주문상품|구매상품|옵션|수량|판매가|가격/g, " ")
  );
}

function findNearbyProductLine(lines: string[], index: number) {
  const nearbyIndexes = [
    index,
    index - 1,
    index - 2,
    index - 3,
    index + 1,
    index + 2,
  ];

  for (const nearbyIndex of nearbyIndexes) {
    const line = lines[nearbyIndex];
    if (!line) continue;

    const candidate = removePurchaseMeta(line);

    if (looksLikeProductLine(candidate)) {
      return candidate;
    }
  }

  return "";
}

function findOrderDateText(text: string) {
  return (
    text.match(/\d{4}[.\-/년]\s?\d{1,2}[.\-/월]\s?\d{1,2}일?/)?.[0] ??
    text.match(/\d{1,2}[.\-/월]\s?\d{1,2}일?/)?.[0] ??
    null
  );
}

export function parseCoupangOrderMailFallback(
  text: string
): MailImportCandidate[] {
  const urls = Array.from(text.matchAll(/https?:\/\/[^\s"'<>]+/g)).map(
    (match) => match[0]
  );
  const coupangUrl = urls.find((url) => url.includes("coupang.com")) ?? "";
  const lines = text
    .split(/\r?\n/)
    .map(cleanImportedLine)
    .filter(Boolean);
  const candidates = new Map<string, MailImportCandidate>();
  const orderDateText = findOrderDateText(text);

  lines.forEach((line, index) => {
    const priceText = getPriceText(line);
    const quantityText =
      getQuantityText(line) ??
      getQuantityText(lines[index - 1] ?? "") ??
      getQuantityText(lines[index + 1] ?? "");
    const withoutPrice = removePurchaseMeta(line);
    const candidateLine = looksLikeProductLine(withoutPrice)
      ? withoutPrice
      : looksLikeProductLine(line)
        ? line
        : priceText
          ? findNearbyProductLine(lines, index)
          : "";

    if (!candidateLine) return;

    const normalized = candidateLine.toLowerCase().replace(/\s+/g, "");

    if (candidates.has(normalized)) return;

    candidates.set(normalized, {
      id: `${index}-${normalized.slice(0, 16)}`,
      productName: candidateLine,
      productUrl: coupangUrl,
      priceText,
      quantityText,
      orderDateText,
      confidence: "low",
      reason: "메일 본문에서 상품명처럼 보이는 줄을 찾았습니다.",
    });
  });

  return Array.from(candidates.values()).slice(0, 8);
}
