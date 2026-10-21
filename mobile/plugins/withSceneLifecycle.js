// iOS 27 會在啟動時直接讓沒採用 UIScene 生命週期的 App 閃退。
// Expo SDK 57 已經有 ExpoAppSceneDelegate，但產生的 AppDelegate 還沒接上，這裡補上：
// 1. Info.plist 加 UIApplicationSceneManifest，指定 EXExpoAppSceneDelegate
// 2. AppDelegate 改成實作 ExpoReactNativeFactoryProvider，視窗交給 scene delegate 建立
// Expo 的範本內建這段之後就可以拿掉。
const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');

const WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

function withSceneLifecycle(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle 只支援 Swift 的 AppDelegate');
    }
    let src = cfg.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      const before = src;
      src = src
        .replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
        .replace(WINDOW_BLOCK, '');
      if (src === before || src.includes('window = UIWindow(frame:')) {
        throw new Error('withSceneLifecycle：AppDelegate 範本改了，請更新這個 plugin');
      }
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = withSceneLifecycle;
