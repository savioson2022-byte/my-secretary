# Gemma 4 온디바이스 연결 계획

## 목표

Gemma 4는 각 기기에서 실행되더라도, 사용자는 하나의 비서와 대화하는 느낌을 받아야 한다.

따라서 모델 자체는 아이폰, 맥북 같은 기기 안에서 돌 수 있지만, 사용자별 기준과 학습 내용은 `personal_ai_memory`에 저장해서 계정 단위로 동기화한다.

## 붙일 5개 지점

1. 입력 분류
   - 짧은 음성/텍스트를 `단기일정`, `메모`, `즉시처리`로 나눈다.
   - 현재는 `/api/classify`와 규칙 기반 fallback을 사용한다.
   - 이후 `classify_input` capability로 Gemma를 먼저 호출하고 실패 시 기존 서버 AI로 넘긴다.

2. 아이디어 묶기
   - 같은 주제의 메모와 아이디어를 기존 아이디어 기록에 붙인다.
   - 현재 `idea` 메모리를 prompt에 반영하도록 연결했다.

3. 시간 추천
   - 빈 시간, 장소, 에너지 수준, 이전 피드백을 기준으로 추천한다.
   - 이후 `rank_schedule` capability로 후보 시간을 재정렬한다.

4. 구매 위임 보조
   - 쿠팡 주문 메일에서 반복 구매 후보를 추출하고, 부속품과 본품을 구분한다.
   - 이후 앱 안에서는 `extract_purchase` 또는 구매 후보 검증을 Gemma가 맡을 수 있다.

5. 알림 문구와 강도
   - 푸시 알림과 지속 알람을 분리하고, 사용자가 바로 이해할 수 있는 문구를 만든다.
   - 이후 `compose_notification` capability로 상황별 문구를 만든다.

## 같은 정체성을 유지하는 방식

- 모델 파일은 기기별로 존재할 수 있다.
- 사용자별 기준은 `personal_ai_memory`에 저장한다.
- 이 데이터는 localStorage와 Supabase 사이에서 동기화된다.
- 아이폰에서 쌓은 기준은 맥북에서도 읽고, 맥북에서 수정한 기준도 아이폰 앱에서 읽는다.

## 현재 구현 상태

- `src/types/personalAi.ts`
- `src/lib/personalAiMemoryStorage.ts`
- `src/lib/local-ai/gemmaAdapter.ts`
- `supabase/migrations/20260717000000_create_personal_ai_memory.sql`

현재 Gemma 런타임은 아직 연결하지 않았고, 연결 지점과 계정 동기화 구조를 먼저 준비했다.

## 다음 단계

1. iOS에서 사용할 온디바이스 추론 런타임을 결정한다.
2. 모델 다운로드/번들 전략을 정한다.
3. Capacitor 네이티브 플러그인으로 `classify`, `groupIdea`, `rankSchedule` 같은 메서드를 노출한다.
4. `src/lib/local-ai/gemmaAdapter.ts`에서 네이티브 플러그인을 호출한다.
5. 실패하거나 기기가 느리면 기존 서버 AI로 fallback한다.
