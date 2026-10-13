import { describe, expect, it } from "vitest";
import { detectInstallState } from "./useInstallState";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_LINE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/15.10.0";
const IPAD_DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";

const detect = (userAgent: string, opts: { touch?: number; standalone?: boolean } = {}) =>
  detectInstallState({
    userAgent,
    maxTouchPoints: opts.touch ?? 5,
    standalone: opts.standalone ?? false,
  });

describe("detectInstallState", () => {
  it("treats standalone as installed regardless of UA", () => {
    expect(detect(IPHONE_SAFARI, { standalone: true })).toBe("installed");
  });

  it("guides iPhone Safari", () => {
    expect(detect(IPHONE_SAFARI)).toBe("ios-browser");
  });

  it("flags the LINE in-app browser", () => {
    expect(detect(IPHONE_LINE)).toBe("ios-in-app");
  });

  it("recognises iPad reporting a Mac UA by touch points", () => {
    expect(detect(IPAD_DESKTOP_UA, { touch: 5 })).toBe("ios-browser");
    expect(detect(IPAD_DESKTOP_UA, { touch: 0 })).toBe("other");
  });

  it("does not guide Android", () => {
    expect(detect(ANDROID_CHROME)).toBe("other");
  });
});
