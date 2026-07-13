import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const rootDir = process.cwd();
const require = createRequire(import.meta.url);

function readSource(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function transpileCommonJs(source, filename) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
}

function runCommonJs(source, filename, sandboxExtras = {}) {
  const exports = {};
  const module = { exports };
  const sandbox = {
    console,
    crypto: globalThis.crypto,
    exports,
    module,
    require,
    ...sandboxExtras,
  };

  vm.runInNewContext(transpileCommonJs(source, filename), sandbox, {
    filename,
  });

  return module.exports;
}

function stripImports(source) {
  return source.replace(/^import .+;\n/gm, "");
}

const purchaseAutomation = runCommonJs(
  [
    readSource("src/lib/coupangLinks.ts"),
    readSource("src/lib/purchaseName.ts"),
    stripImports(readSource("src/lib/purchaseAutomation.ts")),
  ].join("\n"),
  "purchaseAutomation.ts"
);

const purchaseMailSyncWindow = runCommonJs(
  readSource("src/lib/purchaseMailSyncWindow.ts"),
  "purchaseMailSyncWindow.ts"
);

const purchaseMailImport = runCommonJs(
  readSource("src/lib/purchaseMailImport.ts"),
  "purchaseMailImport.ts"
);

const purchasedAt = new Date("2026-07-14T10:00:00+09:00");
const previousHistory = {
  id: "previous",
  productName: "탐사수 생수 2L 12개",
  platform: "coupang",
  productUrl: "https://www.coupang.com/vp/products/1",
  defaultQuantity: 1,
  maxBudgetKrw: 12900,
  repeatCycleDays: null,
  nextPurchaseCheckDate: null,
  source: "mail",
  sourceMessageId: "mail-previous",
  importedAt: "2026-06-16T01:00:00.000Z",
  autoRepurchaseEnabled: true,
  lastPurchasedAt: "2026-06-16T01:00:00.000Z",
  memo: "",
  createdAt: "2026-06-16T01:00:00.000Z",
  updatedAt: "2026-06-16T01:00:00.000Z",
};

const cycle = purchaseAutomation.estimatePurchaseCycle({
  productName: "탐사수 생수 2L 12개",
  purchasedAt,
  histories: [previousHistory],
});

assert.equal(cycle.repeatCycleDays, 28);
assert.equal(cycle.nextPurchaseCheckDate, "2026-08-11");
assert.equal(cycle.confidence, "medium");

const similarNameCycle = purchaseAutomation.estimatePurchaseCycle({
  productName: "탐사수 2L 생수 12병",
  purchasedAt,
  histories: [previousHistory],
});

assert.equal(similarNameCycle.repeatCycleDays, 28);
assert.equal(similarNameCycle.nextPurchaseCheckDate, "2026-08-11");
assert.equal(similarNameCycle.confidence, "medium");

const candidate = {
  id: "candidate",
  productName: "탐사수 생수 2L 12개",
  productUrl: "https://www.coupang.com/vp/products/1",
  priceText: "12,900원",
  quantityText: "2개",
  orderDateText: "2026.07.14",
  confidence: "high",
  reason: "검증 후보",
};
const history = purchaseAutomation.createPurchaseHistoryFromCandidate({
  candidate,
  histories: [previousHistory],
  messageId: "mail-current",
  purchasedAt,
});

assert.equal(history.productName, candidate.productName);
assert.equal(history.productUrl, candidate.productUrl);
assert.equal(history.defaultQuantity, 2);
assert.equal(history.maxBudgetKrw, 12900);
assert.equal(history.source, "mail");
assert.equal(history.sourceMessageId, "mail-current");
assert.equal(history.repeatCycleDays, 28);
assert.equal(history.nextPurchaseCheckDate, "2026-08-11");
assert.equal(history.autoRepurchaseEnabled, true);

const historyWithoutUrl = purchaseAutomation.createPurchaseHistoryFromCandidate({
  candidate: {
    ...candidate,
    productUrl: "",
  },
  histories: [],
  messageId: "mail-without-url",
  purchasedAt,
});

assert.equal(
  historyWithoutUrl.productUrl,
  "https://www.coupang.com/np/search?q=%ED%83%90%EC%82%AC%EC%88%98%20%EC%83%9D%EC%88%98%202L%2012%EA%B0%9C"
);

const dueHistories = purchaseAutomation.getDueRepurchaseHistories(
  [
    {
      ...history,
      id: "future",
      nextPurchaseCheckDate: "2026-08-11",
    },
    {
      ...history,
      id: "due",
      nextPurchaseCheckDate: "2026-07-13",
    },
    {
      ...history,
      id: "disabled",
      autoRepurchaseEnabled: false,
      nextPurchaseCheckDate: "2026-07-12",
    },
  ],
  3,
  new Date("2026-07-14T12:00:00+09:00")
);

assert.deepEqual(
  dueHistories.map((item) => item.id),
  ["due"]
);

const parsedCandidates = purchaseMailImport.parseCoupangOrderMailFallback(`
쿠팡 주문이 완료되었습니다.
탐사수 생수 2L 12개 12,900원
배송비 0원
https://www.coupang.com/vp/products/1
`);

assert.equal(parsedCandidates.length, 1);
assert.equal(parsedCandidates[0].productName, "탐사수 생수 2L 12개");
assert.equal(parsedCandidates[0].priceText, "12,900원");
assert.equal(parsedCandidates[0].quantityText, "12개");
assert.equal(parsedCandidates[0].productUrl, "https://www.coupang.com/vp/products/1");

assert.equal(
  purchaseMailSyncWindow.getNextPurchaseMailSyncAfter(
    new Date("2026-07-14T12:00:00.000Z")
  ),
  "2026-07-13T12:00:00.000Z"
);

console.log("purchase automation verification passed");
