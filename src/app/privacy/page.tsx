import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "나의 비서 앱의 개인정보 처리 기준입니다.",
};

const updatedAt = "2026년 7월 30일";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10 text-slate-700">
      <Link href="/" className="text-sm font-black text-blue-600">
        ← 나의 비서
      </Link>
      <h1 className="mt-6 text-3xl font-black text-slate-950">
        개인정보처리방침
      </h1>
      <p className="mt-2 text-sm font-semibold text-slate-500">
        시행 및 최종 수정일: {updatedAt}
      </p>

      <div className="mt-8 space-y-8 leading-7">
        <section>
          <h2 className="text-xl font-black text-slate-900">1. 처리 목적</h2>
          <p className="mt-2">
            나의 비서는 회원 인증, 일정·작업·메모 관리, 음성 입력, 장소와
            이동시간 계산, 알림 발송, 구매 메일 자동 정리 및 개인화된 AI 추천을
            제공하기 위해 필요한 정보를 처리합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-slate-900">
            2. 처리하는 정보
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>계정 정보: 이메일 주소, 사용자 ID, 표시 이름, 로그인 제공자</li>
            <li>사용자 콘텐츠: 일정, 작업, 메모, 장소, 선호 설정과 AI 수정 기록</li>
            <li>
              음성 정보: 사용자가 음성 입력을 실행할 때 음성을 텍스트로 변환하기
              위한 일시적 오디오 입력
            </li>
            <li>
              위치 정보: 사용자가 허용한 경우 일정 장소까지의 이동시간과 출발
              알림을 계산하기 위한 현재 위치
            </li>
            <li>
              구매 정보: 사용자가 직접 연결한 Gmail 또는 Naver 메일에서 확인한
              구매 관련 메일과 구매 이력
            </li>
            <li>
              기기 및 알림 정보: 등록 기기 이름, 푸시 토큰, 알림 설정과 전송 기록
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-slate-900">
            3. 이용 및 제3자 처리
          </h2>
          <p className="mt-2">
            서비스 제공을 위해 Supabase(인증·데이터 저장), Vercel(웹 및 서버
            실행), Apple(푸시 알림·음성 인식·앱 배포), OpenAI 또는 사용자가
            선택한 AI 제공자, Kakao·ODsay·Naver·Google(장소, 이동시간, 메일
            연결)의 기능을 사용할 수 있습니다. 각 제공자에는 기능 수행에 필요한
            최소한의 정보만 전달합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-slate-900">
            4. 보관 및 삭제
          </h2>
          <p className="mt-2">
            계정 데이터는 사용자가 서비스를 이용하는 동안 보관합니다. 설정의
            ‘계정과 동기화’에서 계정 삭제를 실행하면 인증 계정과 연결된 서버
            데이터를 삭제합니다. 기기에 남은 앱 데이터도 함께 제거합니다. 법령상
            별도 보관 의무가 있는 경우에만 해당 기간 동안 제한적으로 보관합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-slate-900">
            5. 사용자의 선택권
          </h2>
          <p className="mt-2">
            위치, 마이크, 음성 인식, 알림 권한은 기기 설정에서 언제든 철회할 수
            있습니다. 메일 연결은 구매 관리 화면에서 해제할 수 있으며, 계정과
            전체 데이터는 앱 안에서 삭제할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-slate-900">6. 보호 조치</h2>
          <p className="mt-2">
            전송 구간 암호화, 접근 권한 통제, 사용자별 데이터 접근 정책을
            적용합니다. Gmail 토큰과 Naver 앱 비밀번호는 서버에서 암호화하여
            저장하며 클라이언트에 노출하지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-slate-900">7. 문의</h2>
          <p className="mt-2">
            개인정보 또는 계정 삭제에 관한 문의는{" "}
            <Link href="/support" className="font-black text-blue-600">
              나의 비서 지원 페이지
            </Link>
            를 이용해주세요.
          </p>
        </section>
      </div>
    </main>
  );
}
