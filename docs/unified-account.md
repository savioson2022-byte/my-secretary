# 통합계정 구조

나의 비서는 Supabase Auth를 로그인 입구로 사용하고, 앱 내부 사용자는 별도의 통합계정으로 관리한다.

## 목적

- 카카오, Google, Apple, 이메일 로그인을 모두 같은 사용자 계정에 연결한다.
- 로그인 제공자가 바뀌어도 앱 데이터는 같은 통합계정 기준으로 이어진다.
- iPhone, Mac, 이후 Apple Watch까지 같은 통합계정의 기기로 관리한다.

## 테이블

- `app_accounts`: 앱에서 보는 실제 사용자 계정
- `account_identities`: 카카오, Google, Apple, 이메일 같은 로그인 경로와 통합계정의 연결

## 현재 적용 단계

1. Supabase Auth로 로그인한다.
2. 앱이 현재 로그인 사용자의 `auth.users.id`를 확인한다.
3. `account_identities`에 기존 연결이 있으면 해당 `app_accounts`를 사용한다.
4. 연결이 없으면 새 `app_accounts`를 만들고 현재 로그인 경로를 연결한다.

## 다음 단계

- 기존 `profiles`, `devices`, 일정/기록 테이블을 `auth.users.id`가 아니라 `app_account_id` 기준으로 점진 이전한다.
- 서로 다른 provider 계정을 같은 통합계정으로 묶는 “계정 연결” 화면을 만든다.
- 통합계정 병합은 실수 위험이 있으므로 반드시 현재 로그인 + 추가 provider 재인증을 요구한다.
