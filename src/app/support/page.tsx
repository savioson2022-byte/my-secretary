import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "지원",
  description: "나의 비서 앱 사용 및 계정 지원 안내입니다.",
};

export default function SupportPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10 text-slate-700">
      <Link href="/" className="text-sm font-black text-blue-600">
        ← 나의 비서
      </Link>
      <h1 className="mt-6 text-3xl font-black text-slate-950">
        나의 비서 지원
      </h1>
      <p className="mt-3 leading-7">
        로그인, 일정 저장, 알림, 위치 기반 이동 알림, 음성 입력 및 구매 메일
        연결에 문제가 있다면 아래 내용을 먼저 확인해주세요.
      </p>

      <div className="mt-8 space-y-4">
        {[
          [
            "알림이 오지 않아요",
            "앱의 알림 설정과 iPhone 설정의 알림 허용, 집중 모드 및 소리 설정을 확인해주세요.",
          ],
          [
            "위치 기반 출발 알림이 맞지 않아요",
            "위치 권한을 허용하고 일정의 장소와 이동수단이 올바른지 확인해주세요.",
          ],
          [
            "음성 입력이 되지 않아요",
            "iPhone 설정에서 나의 비서의 마이크와 음성 인식 권한을 허용해주세요.",
          ],
          [
            "계정을 삭제하고 싶어요",
            "앱의 설정 → 계정과 동기화 → 계정 및 데이터 삭제에서 직접 삭제할 수 있습니다.",
          ],
        ].map(([title, body]) => (
          <section key={title} className="app-card p-5">
            <h2 className="font-black text-slate-900">{title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              {body}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-3xl bg-blue-50 p-5 ring-1 ring-blue-100">
        <h2 className="font-black text-slate-900">문의 전 확인</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          문의 채널을 준비 중입니다. 긴급한 개인정보 삭제는 앱 내부의 계정 삭제
          기능을 이용하면 즉시 처리됩니다.
        </p>
      </div>

      <p className="mt-8 text-sm font-bold">
        <Link href="/privacy" className="text-blue-600">
          개인정보처리방침 보기
        </Link>
      </p>
    </main>
  );
}
