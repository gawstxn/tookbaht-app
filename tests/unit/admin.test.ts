import { describe, expect, it } from "vitest"
import { dataSize, deviceLabel, isSuspended, megabytes } from "@/lib/admin"

describe("reading a problem report's device", () => {
  it("names the device and the browser", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("iPhone · Safari")
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("Android · Chrome")
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
      ),
    ).toBe("Windows · Edge")
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.9.0",
      ),
    ).toBe("iPhone · LINE")
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0")).toBe(
      "Mac · Firefox",
    )
  })

  it("says nothing when it can't tell", () => {
    expect(deviceLabel("")).toBe("")
    expect(deviceLabel("curl/8.0")).toBe("")
  })
})

describe("database size", () => {
  it("is shown in megabytes", () => {
    expect(megabytes(24_536_678)).toBe("23.4 MB")
    expect(megabytes(500 * 1024 * 1024)).toBe("500 MB")
    expect(megabytes(0)).toBe("0.0 MB")
    expect(dataSize(21_745)).toBe("21 KB")
    expect(dataSize(3_565_158)).toBe("3.4 MB")
  })
})

describe("a suspended account", () => {
  it("is recognised by the database's error code", () => {
    expect(isSuspended({ code: "PT403", message: "account suspended" })).toBe(true)
    expect(isSuspended({ code: "42501", message: "permission denied" })).toBe(false)
    expect(isSuspended(new Error("timed out"))).toBe(false)
    expect(isSuspended(null)).toBe(false)
  })
})
