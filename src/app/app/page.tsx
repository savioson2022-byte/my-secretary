import BottomNavigation from "@/components/BottomNavigation";
import UserStatusBadge from "@/components/UserStatusBadge";
import Link from "next/link";

const QUICK_ACTIONS = [
  {
    title: "음성 기록",
    body: "앱 아이콘을 길게 누르거나 단축어에서 열어 바로 말하기로 들어갑니다.",
    href: "/?voice=1",
  },
  {
    title: "오늘 일정",
    body: "오늘 확정된 일정과 미확정 액션을 먼저 확인합니다.",
    href: "/",
  },
  {
    title: "알림 설정",
    body: "아침/저녁 미확정 알림, 즉시처리, 기기 연결을 조절합니다.",
    href: "/settings",
  },
];

const APP_STEPS = [
  "Mac에서 Xcode로 iOS 프로젝트를 연다.",
  "Apple Developer 계정의 Team과 Bundle ID를 연결한다.",
  "Archive를 만든 뒤 App Store Connect에 올린다.",
  "먼저 TestFlight로 iPhone에서 실제 알림과 음성 기록을 검증한다.",
  "문제가 없으면 같은 빌드를 App Store 심사로 보낸다.",
];

export default function AppInstallPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 pb-24">
      <header className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <p className="text-sm font-black text-blue-600">나의 비서</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            앱으로 사용하기
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            웹 바로가기보다 빠르게 열고, TestFlight와 App Store 배포로
            실제 앱처럼 쓰기 위한 준비 화면입니다.
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <UserStatusBadge />
        </div>
      </header>

      <div className="space-y-5">
        <section className="app-card overflow-hidden">
          <div className="bg-slate-950 px-5 py-6 text-white">
            <p className="text-xs font-black text-blue-200">빠른 실행</p>
            <h2 className="mt-2 text-2xl font-black">
              파스모처럼 빠르게 여는 구조
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              iPhone에서는 전원/볼륨 버튼 조합을 앱이 직접 가로채기 어렵습니다.
              대신 앱 아이콘 길게 누르기, Action Button, Siri 단축어, 위젯,
              알림 액션으로 같은 목적을 구현합니다.
            </p>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="rounded-3xl bg-slate-50 p-4 no-underline ring-1 ring-slate-100 transition hover:bg-blue-50"
              >
                <h3 className="text-base font-black text-slate-950">
                  {action.title}
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {action.body}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="app-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                iPhone에 설치하는 가장 좋은 순서
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                지금은 Capacitor 기반 iOS 앱 프로젝트가 준비되어 있습니다.
                App Store에 바로 올리기 전, TestFlight로 먼저 하루 사용감을
                확인하는 흐름이 가장 안전합니다.
              </p>
            </div>
            <a
              href="https://appstoreconnect.apple.com/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-blue-600 px-4 py-2 text-center text-xs font-black text-white no-underline"
            >
              App Store Connect
            </a>
          </div>

          <ol className="mt-5 space-y-3">
            {APP_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-100"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm font-bold leading-5 text-slate-700">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="app-card p-5">
          <h2 className="text-lg font-black text-slate-900">
            음성 기록을 버튼처럼 쓰는 방법
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-sm font-black text-slate-900">
                Action Button / Siri 단축어
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                단축어에서 URL 열기를 만들고 아래 주소를 연결하면,
                버튼이나 음성 명령으로 바로 기록 화면을 열 수 있습니다.
              </p>
              <code className="mt-3 block break-all rounded-2xl bg-white p-3 text-[11px] font-bold text-slate-600 ring-1 ring-slate-100">
                https://my-secretary-remote.vercel.app/?voice=1
              </code>
              <code className="mt-2 block break-all rounded-2xl bg-white p-3 text-[11px] font-bold text-slate-600 ring-1 ring-slate-100">
                mysecretary://voice
              </code>
            </div>

            <div className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <p className="text-sm font-black text-slate-900">
                네이티브 앱 빠른 동작
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                iOS 앱 프로젝트에는 홈 화면 아이콘 길게 누르기용 빠른 동작이
                들어갔습니다. 실제 기기 빌드 후 음성 기록, 오늘 일정, 설정으로
                바로 이동합니다.
              </p>
            </div>
          </div>
        </section>

        <section className="app-card p-5">
          <h2 className="text-lg font-black text-slate-900">
            외부 다운로드 방식에 대한 결론
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            iPhone 앱은 일반 웹사이트에서 파일을 내려받아 설치하는 방식이
            사용자에게 안정적이지 않습니다. 실제 사용자에게 배포하려면
            TestFlight 또는 App Store가 맞고, 지인 테스트도 TestFlight가 가장
            편합니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="https://developer.apple.com/testflight/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white no-underline"
            >
              TestFlight 안내
            </a>
            <Link
              href="/settings"
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 no-underline"
            >
              설정으로 이동
            </Link>
          </div>
        </section>
      </div>

      <BottomNavigation />
    </main>
  );
}
