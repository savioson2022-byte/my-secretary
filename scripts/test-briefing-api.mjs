import assert from "node:assert/strict";
import {
  buildBriefingResponse,
  formatKst,
  hasTokenInQuery,
  isBriefingTokenAuthorized,
  kstDateTimeToMs,
  resolveRange,
} from "../src/lib/briefing/briefingCore.ts";

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const TOKEN = "unit-test-token-not-real";

console.log("인증");
test("올바른 Bearer 토큰 → 허용", () => {
  assert.equal(isBriefingTokenAuthorized(`Bearer ${TOKEN}`, TOKEN), true);
});
test("토큰 누락 → 거부", () => {
  assert.equal(isBriefingTokenAuthorized(null, TOKEN), false);
  assert.equal(isBriefingTokenAuthorized("", TOKEN), false);
  assert.equal(isBriefingTokenAuthorized("Bearer ", TOKEN), false);
});
test("틀린 토큰·길이 다른 토큰 → 거부", () => {
  assert.equal(isBriefingTokenAuthorized("Bearer wrong", TOKEN), false);
  assert.equal(isBriefingTokenAuthorized(`Bearer ${TOKEN}x`, TOKEN), false);
});
test("Bearer 아닌 스킴 → 거부", () => {
  assert.equal(isBriefingTokenAuthorized(`Basic ${TOKEN}`, TOKEN), false);
  assert.equal(isBriefingTokenAuthorized(TOKEN, TOKEN), false);
});
test("서버 토큰 미설정 → 항상 거부", () => {
  assert.equal(isBriefingTokenAuthorized("Bearer undefined", undefined), false);
  assert.equal(isBriefingTokenAuthorized("Bearer ", ""), false);
});
test("쿼리스트링 토큰 감지", () => {
  assert.equal(hasTokenInQuery(new URLSearchParams("token=abc")), true);
  assert.equal(hasTokenInQuery(new URLSearchParams("from=2026-11-04")), false);
});

console.log("범위");
// 2026-11-04 07:50 KST
const NOW = Date.parse("2026-11-04T07:50:00+09:00");
test("기본값: 오늘 00:00 ~ 내일 24:00 KST", () => {
  const r = resolveRange(null, null, NOW);
  assert.ok(r.ok);
  assert.equal(formatKst(r.range.fromMs), "2026-11-04T00:00:00+09:00");
  assert.equal(formatKst(r.range.toMs), "2026-11-06T00:00:00+09:00");
});
test("KST 자정 직전 UTC 시각도 KST 날짜 기준", () => {
  // 2026-11-03T15:30Z = 2026-11-04 00:30 KST
  const r = resolveRange(null, null, Date.parse("2026-11-03T15:30:00Z"));
  assert.equal(formatKst(r.range.fromMs), "2026-11-04T00:00:00+09:00");
});
test("ISO(오프셋 포함)·날짜만 입력 허용", () => {
  const r = resolveRange("2026-11-04T00:00:00+09:00", "2026-11-05", NOW);
  assert.ok(r.ok);
  assert.equal(formatKst(r.range.toMs), "2026-11-05T00:00:00+09:00");
  const z = resolveRange("2026-11-03T15:00:00Z", null, NOW);
  assert.equal(formatKst(z.range.fromMs), "2026-11-04T00:00:00+09:00");
});
test("시간대 없는 날짜시간·잘못된 값 → 거부", () => {
  assert.equal(resolveRange("2026-11-04T00:00:00", null, NOW).ok, false);
  assert.equal(resolveRange("abc", null, NOW).ok, false);
  assert.equal(resolveRange("2026-02-30", null, NOW).ok, false);
});
test("최대 14일, to > from", () => {
  assert.equal(resolveRange("2026-11-01", "2026-11-15", NOW).ok, true);
  assert.equal(resolveRange("2026-11-01", "2026-11-15T00:00:01+09:00", NOW).ok, false);
  assert.equal(resolveRange("2026-11-05", "2026-11-04", NOW).ok, false);
});

console.log("응답 구성");
const range = resolveRange(null, null, NOW).range; // 11/04(수) ~ 11/05(목)

const singleRows = [
  { id: "s1", title: "치과", date: "2026-11-04", start_time: "15:00:00", end_time: "16:00:00", place_name: "강남", memo: "", updated_at: "2026-11-01T00:00:00Z", user_id: "SECRET-USER" },
  { id: "s2", title: "범위 밖", date: "2026-11-07", start_time: "10:00", end_time: "11:00", place_name: "", memo: "" },
  // 전날 밤 → 범위 시작 자정을 넘김: 포함돼야 함
  { id: "s3", title: "야간 작업", date: "2026-11-03", start_time: "23:00", end_time: "01:00", place_name: "", memo: "" },
  // 범위 마지막 날 밤 → 범위 끝 자정을 넘김: 포함
  { id: "s4", title: "심야 영화", date: "2026-11-05", start_time: "23:30", end_time: "01:30", place_name: "", memo: "팝콘" },
  // 전날 22~23시: 범위 밖
  { id: "s5", title: "전날 저녁", date: "2026-11-03", start_time: "22:00", end_time: "23:00", place_name: "", memo: "" },
];
const routineRows = [
  // 매주 수요일, 11/04는 해당
  { id: "r1", title: "수영", day_of_week: "수", start_time: "07:00:00", end_time: "08:00:00", place_name: "체육관", memo: "", start_date: null, end_date: null, is_active: true, cancelled_dates: [] },
  // 목요일이지만 11/05 취소
  { id: "r2", title: "스터디", day_of_week: "목", start_time: "19:00", end_time: "21:00", place_name: "", memo: "", start_date: null, end_date: null, is_active: true, cancelled_dates: ["2026-11-05"] },
  // 비활성
  { id: "r3", title: "비활성", day_of_week: "수", start_time: "09:00", end_time: "10:00", is_active: false },
  // 기간 종료
  { id: "r4", title: "종료된 수업", day_of_week: "목", start_time: "09:00", end_time: "10:00", end_date: "2026-11-01", is_active: true },
  // 기간 시작 전
  { id: "r5", title: "다음 학기", day_of_week: "수", start_time: "09:00", end_time: "10:00", start_date: "2026-12-01", is_active: true },
];
const itemRows = [
  { id: "t1", title: "보고서", original_text: "보고서 쓰기", category: "업무", process_type: "시간작업", priority: "높음", status: "미완료", estimated_minutes: 60, due_date: "2026-11-05", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
  { id: "t2", title: "마감 없음", original_text: "", category: "기타", process_type: "즉시처리", priority: "보통", status: "보류", estimated_minutes: null, due_date: null, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
  { id: "t3", title: "다음 주 할 일", original_text: "", category: "기타", process_type: "시간작업", priority: "낮음", status: "미완료", due_date: "2026-11-20", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
  { id: "t4", title: "끝낸 일", original_text: "", category: "기타", process_type: "시간작업", priority: "보통", status: "완료", due_date: "2026-11-04", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
  { id: "t5", title: "지난 마감", original_text: "", category: "기타", process_type: "에이전트위임", priority: "보통", status: "미완료", due_date: "2026-11-01", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z" },
  { id: "x1", title: "일정형 기록", original_text: "", category: "기타", process_type: "단기일정", priority: "보통", status: "미완료", due_date: "2026-11-04", created_at: "2026-11-04T00:00:00Z", updated_at: "2026-11-04T00:00:00Z" },
  { id: "n1", title: "아이디어", original_text: "a".repeat(250), category: "기타", process_type: "아이디어", priority: "보통", status: "미완료", due_date: null, created_at: "2026-11-04T01:00:00Z", updated_at: "2026-11-04T01:00:00Z" },
  { id: "n2", title: "오래된 메모", original_text: "옛날", category: "기타", process_type: "메모", priority: "보통", status: "미완료", due_date: null, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" },
];

const body = buildBriefingResponse({ nowMs: NOW, range, includeDone: false, singleRows, routineRows, itemRows });

test("메타 정보", () => {
  assert.equal(body.version, 1);
  assert.equal(body.timezone, "Asia/Seoul");
  assert.equal(body.generatedAt, "2026-11-04T07:50:00+09:00");
  assert.deepEqual(body.range, { from: "2026-11-04T00:00:00+09:00", to: "2026-11-06T00:00:00+09:00" });
});

test("일정: 범위·반복 펼치기·취소일·기간·비활성·자정 경계", () => {
  const ids = body.events.map((e) => e.id);
  assert.deepEqual(ids, ["s3", "routine-r1-2026-11-04", "s1", "s4"]);
});

test("일정: 시간 형식(+09:00)·자정 넘김 종료일", () => {
  const night = body.events.find((e) => e.id === "s3");
  assert.equal(night.start, "2026-11-03T23:00:00+09:00");
  assert.equal(night.end, "2026-11-04T01:00:00+09:00");
  const movie = body.events.find((e) => e.id === "s4");
  assert.equal(movie.end, "2026-11-06T01:30:00+09:00");
  assert.equal(movie.memo, "팝콘");
  const dentist = body.events.find((e) => e.id === "s1");
  assert.deepEqual(dentist, {
    id: "s1", sourceId: "s1", type: "single", title: "치과",
    start: "2026-11-04T15:00:00+09:00", end: "2026-11-04T16:00:00+09:00",
    allDay: false, location: "강남", category: null, memo: null, needsPrep: false,
  });
  for (const e of body.events) assert.match(e.start, /\+09:00$/);
});

test("일정: 범위 끝 정확히 24:00에 시작하는 건 제외", () => {
  const r = buildBriefingResponse({
    nowMs: NOW, range, includeDone: false, itemRows: [], routineRows: [],
    singleRows: [{ id: "edge", title: "자정", date: "2026-11-06", start_time: "00:00", end_time: "01:00" }],
  });
  assert.equal(r.events.length, 0);
});

test("할 일: 완료 제외, 범위 뒤 마감 제외, 지난 마감·마감 없음 포함, 일정형 기록 제외", () => {
  assert.deepEqual(body.tasks.map((t) => t.id), ["t5", "t1", "t2"]);
  const t1 = body.tasks.find((t) => t.id === "t1");
  assert.deepEqual(t1, {
    id: "t1", title: "보고서", due: "2026-11-05T00:00:00+09:00", dueDate: "2026-11-05",
    status: "todo", priority: "high", category: "업무", estimatedMinutes: 60, memo: null,
  });
  assert.equal(body.tasks.find((t) => t.id === "t2").status, "on_hold");
});

test("할 일: includeDone=true면 범위 안 완료 포함", () => {
  const r = buildBriefingResponse({ nowMs: NOW, range, includeDone: true, singleRows, routineRows, itemRows });
  const done = r.tasks.find((t) => t.id === "t4");
  assert.equal(done.status, "done");
});

test("기록: 범위 안 메모/아이디어만, 요약 200자", () => {
  assert.deepEqual(body.notes.map((n) => n.id), ["n1"]);
  assert.equal(body.notes[0].summary.length, 201);
  assert.equal(body.notes[0].type, "idea");
  assert.equal(body.notes[0].date, "2026-11-04T10:00:00+09:00");
});

test("민감·내부 필드 미노출", () => {
  const json = JSON.stringify(body);
  assert.equal(json.includes("SECRET-USER"), false);
  assert.equal(json.includes("user_id"), false);
  assert.equal(json.includes("original_text"), false);
});

test("중복 id는 최신 하나만", () => {
  const r = buildBriefingResponse({
    nowMs: NOW, range, includeDone: false, itemRows: [], routineRows: [],
    singleRows: [
      { id: "d", title: "old", date: "2026-11-04", start_time: "10:00", end_time: "11:00", updated_at: "2026-11-01T00:00:00Z" },
      { id: "d", title: "new", date: "2026-11-04", start_time: "10:00", end_time: "11:00", updated_at: "2026-11-02T00:00:00Z" },
    ],
  });
  assert.deepEqual(r.events.map((e) => e.title), ["new"]);
});

test("kstDateTimeToMs 왕복", () => {
  assert.equal(formatKst(kstDateTimeToMs("2026-12-31", "23:59")), "2026-12-31T23:59:00+09:00");
});

console.log(`briefing api: ${passed}/${passed} passed`);
