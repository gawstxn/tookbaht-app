import { describe, expect, it } from "vitest";
import { installMode, isLineApp } from "@/lib/install";

const env = (ua: string, over: Partial<Parameters<typeof installMode>[0]> = {}) =>
  installMode({ ua, maxTouchPoints: 5, standalone: false, canPrompt: false, ...over });

const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";
const LINE_ANDROID = "Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36 Line/14.12.0";
const FB_ANDROID = "Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.0;]";
const SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const LINE_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.12.0";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

describe("install button mode", () => {
  it("is hidden once installed", () => {
    expect(env(CHROME_ANDROID, { standalone: true, canPrompt: true })).toBe("hidden");
  });

  it("uses the browser prompt when there is one", () => {
    expect(env(CHROME_ANDROID, { canPrompt: true })).toBe("native");
    expect(env(DESKTOP, { canPrompt: true, maxTouchPoints: 0 })).toBe("native");
  });

  it("shows menu steps on Android when the browser doesn't prompt", () => {
    expect(env(CHROME_ANDROID)).toBe("android");
    expect(env(SAMSUNG)).toBe("android");
  });

  it("asks to open a real browser from LINE / Facebook", () => {
    expect(env(LINE_ANDROID)).toBe("inApp");
    expect(env(FB_ANDROID)).toBe("inApp");
    expect(env(LINE_IOS)).toBe("inApp");
    expect(isLineApp(LINE_IOS)).toBe(true);
    expect(isLineApp(FB_ANDROID)).toBe(false);
  });

  it("shows Safari steps on iPhone and nothing on desktop without a prompt", () => {
    expect(env(SAFARI_IOS)).toBe("ios");
    expect(env(DESKTOP, { maxTouchPoints: 0 })).toBe("hidden");
  });
});
