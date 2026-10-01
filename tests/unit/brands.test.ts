import { describe, expect, it } from "vitest"
import { BRANDS, findBrand, suggestCategory } from "@/lib/brands"
import { BRAND_PATHS } from "@/lib/brands.paths"
import { SUB_CATALOG } from "@/lib/constants"

describe("brands", () => {
  it("recognises domain and hosting services", () => {
    expect(findBrand("Cloudflare")?.key).toBe("cloudflare")
    expect(findBrand("Namecheap domain")?.key).toBe("namecheap")
    expect(findBrand("Vercel Pro")?.key).toBe("vercel")
    expect(suggestCategory("Cloudflare")).toBe("cloud")
    expect(suggestCategory("AWS")).toBe("cloud")
  })

  it("has a logo path for every brand marked with a logo", () => {
    for (const b of BRANDS.filter((b) => b.logo)) expect(BRAND_PATHS[b.key], b.key).toBeTruthy()
  })

  it("has a brand for every name in the domains & hosting catalog group", () => {
    const web = SUB_CATALOG.find((g) => g.names.includes("Cloudflare"))!
    for (const name of web.names) expect(findBrand(name), name).toBeDefined()
  })
})
