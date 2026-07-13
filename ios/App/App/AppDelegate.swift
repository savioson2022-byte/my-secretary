import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private let appBaseURL = "https://my-secretary-remote.vercel.app"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        if let shortcutItem = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem {
            openShortcut(shortcutItem)
            return false
        }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        let proxyHandled = ApplicationDelegateProxy.shared.application(app, open: url, options: options)
        let routeHandled = openDeepLink(url)
        return proxyHandled || routeHandled
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(openShortcut(shortcutItem))
    }

    @discardableResult
    private func openShortcut(_ shortcutItem: UIApplicationShortcutItem) -> Bool {
        guard let path = path(forShortcutType: shortcutItem.type) else {
            return false
        }

        openWebPath(path)
        return true
    }

    @discardableResult
    private func openDeepLink(_ url: URL) -> Bool {
        guard url.scheme == "mysecretary" || url.scheme == "my-secretary" else {
            return false
        }

        let target = [url.host, url.path]
            .compactMap { $0 }
            .joined(separator: "/")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        switch target {
        case "auth/callback":
            var path = "/auth/callback"
            if let query = url.query, !query.isEmpty {
                path += "?\(query)"
            }
            openWebPath(path)
        case "auth/session":
            var path = "/auth/native-callback"
            if let fragment = url.fragment, !fragment.isEmpty {
                path += "#\(fragment)"
            }
            openWebPath(path)
        case "voice", "record", "memo":
            openWebPath("/?voice=1")
        case "today", "":
            openWebPath("/")
        case "settings":
            openWebPath("/settings")
        case "app":
            openWebPath("/app")
        default:
            return false
        }

        return true
    }

    private func path(forShortcutType type: String) -> String? {
        switch type {
        case "app.mysecretary.shortcut.voice":
            return "/?voice=1"
        case "app.mysecretary.shortcut.today":
            return "/"
        case "app.mysecretary.shortcut.settings":
            return "/settings"
        default:
            return nil
        }
    }

    private func openWebPath(_ path: String) {
        guard let url = URL(string: "\(appBaseURL)\(path)") else {
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            guard let bridgeViewController = self?.bridgeViewController(from: self?.window?.rootViewController) else {
                return
            }

            bridgeViewController.webView?.load(URLRequest(url: url))
        }
    }

    private func bridgeViewController(from viewController: UIViewController?) -> CAPBridgeViewController? {
        if let bridgeViewController = viewController as? CAPBridgeViewController {
            return bridgeViewController
        }

        if let navigationController = viewController as? UINavigationController {
            return bridgeViewController(from: navigationController.visibleViewController)
        }

        if let tabBarController = viewController as? UITabBarController {
            return bridgeViewController(from: tabBarController.selectedViewController)
        }

        if let presentedViewController = viewController?.presentedViewController {
            return bridgeViewController(from: presentedViewController)
        }

        for childViewController in viewController?.children ?? [] {
            if let bridgeViewController = bridgeViewController(from: childViewController) {
                return bridgeViewController
            }
        }

        return nil
    }
}
