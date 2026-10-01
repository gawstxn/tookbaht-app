/**
 * Minimal QR Code encoder (byte mode, error correction level M, versions 1–10),
 * enough for PromptPay payloads (~70 characters). Follows ISO/IEC 18004; the
 * structure mirrors Nayuki's reference implementation. Returns a square grid,
 * true = dark module, without the quiet zone.
 */

// Level M: error-correction codewords per block and number of blocks, versions 1–10.
const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const MAX_VERSION = 10

const sizeOf = (v: number) => v * 4 + 17

/** Data + ECC modules available in a version, in bits. */
function rawModules(v: number): number {
  let r = (16 * v + 128) * v + 64
  if (v >= 2) {
    const n = Math.floor(v / 7) + 2
    r -= (25 * n - 10) * n - 55
    if (v >= 7) r -= 36
  }
  return r
}

const dataCodewords = (v: number) => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[v - 1] * NUM_BLOCKS[v - 1]

/* Reed–Solomon over GF(256) with the QR polynomial 0x11D. */
function gfMul(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return result
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)))
  }
  return result
}

/** Splits data into blocks, adds ECC, and interleaves (ISO 18004 §7.6). */
function addEcc(data: number[], v: number): number[] {
  const numBlocks = NUM_BLOCKS[v - 1]
  const eccLen = ECC_PER_BLOCK[v - 1]
  const raw = Math.floor(rawModules(v) / 8)
  const numShort = numBlocks - (raw % numBlocks)
  const shortLen = Math.floor(raw / numBlocks)
  const divisor = rsDivisor(eccLen)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1))
    k += dat.length
    const ecc = rsRemainder(dat, divisor)
    if (i < numShort) dat.push(0) // placeholder so all blocks line up
    blocks.push([...dat, ...ecc])
  }
  const out: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) out.push(block[i])
    })
  }
  return out
}

function alignmentPositions(v: number): number[] {
  if (v === 1) return []
  const n = Math.floor(v / 7) + 2
  const step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2
  const out = [6]
  for (let pos = sizeOf(v) - 7; out.length < n; pos -= step) out.splice(1, 0, pos)
  return out
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0

class Grid {
  readonly size: number
  readonly dark: boolean[][]
  readonly fixed: boolean[][]
  constructor(readonly version: number) {
    this.size = sizeOf(version)
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
    this.fixed = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false))
  }
  set(x: number, y: number, d: boolean) {
    this.dark[y][x] = d
    this.fixed[y][x] = true
  }
  drawPatterns() {
    const s = this.size
    for (let i = 0; i < s; i++) {
      this.set(6, i, i % 2 === 0)
      this.set(i, 6, i % 2 === 0)
    }
    this.finder(3, 3)
    this.finder(s - 4, 3)
    this.finder(3, s - 4)
    const pos = alignmentPositions(this.version)
    const n = pos.length
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            this.set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
    this.format(0) // reserve; real bits drawn after masking
    this.versionInfo()
  }
  finder(cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        this.set(x, y, d !== 2 && d !== 4)
      }
  }
  format(mask: number) {
    // Level M = 0b00.
    const data = (0 << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const s = this.size
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i))
    this.set(8, 7, bit(bits, 6))
    this.set(8, 8, bit(bits, 7))
    this.set(7, 8, bit(bits, 8))
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i))
    for (let i = 0; i < 8; i++) this.set(s - 1 - i, 8, bit(bits, i))
    for (let i = 8; i < 15; i++) this.set(8, s - 15 + i, bit(bits, i))
    this.set(8, s - 8, true)
  }
  versionInfo() {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const b = bit(bits, i)
      const a = this.size - 11 + (i % 3)
      const c = Math.floor(i / 3)
      this.set(a, c, b)
      this.set(c, a, b)
    }
  }
  placeData(codewords: number[]) {
    let i = 0
    const s = this.size
    for (let right = s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (let vert = 0; vert < s; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? s - 1 - vert : vert
          if (!this.fixed[y][x] && i < codewords.length * 8) {
            this.dark[y][x] = bit(codewords[i >>> 3], 7 - (i & 7))
            i++
          }
        }
    }
  }
  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        if (this.fixed[y][x]) continue
        let invert: boolean
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0
            break
          case 1:
            invert = y % 2 === 0
            break
          case 2:
            invert = x % 3 === 0
            break
          case 3:
            invert = (x + y) % 3 === 0
            break
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
            break
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0
            break
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
            break
          default:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
        }
        if (invert) this.dark[y][x] = !this.dark[y][x]
      }
  }
  /** ISO 18004 §7.8.3 penalty score; lower is better. */
  penalty(): number {
    const s = this.size
    const g = this.dark
    let score = 0
    const runs = (get: (i: number, j: number) => boolean) => {
      for (let i = 0; i < s; i++) {
        let run = 1
        for (let j = 1; j <= s; j++) {
          if (j < s && get(i, j) === get(i, j - 1)) run++
          else {
            if (run >= 5) score += 3 + (run - 5)
            run = 1
          }
        }
        // Finder-like 1:1:3:1:1 patterns with 4 light modules on a side.
        for (let j = 0; j + 11 <= s; j++) {
          const p = Array.from({ length: 11 }, (_, k) => get(i, j + k))
          const core = p[4] && !p[5] && p[6] && p[7] && p[8] && !p[9] && p[10]
          const a = !p[0] && !p[1] && !p[2] && !p[3] && core
          const q = Array.from({ length: 11 }, (_, k) => get(i, j + 10 - k))
          const b = !q[0] && !q[1] && !q[2] && !q[3] && q[4] && !q[5] && q[6] && q[7] && q[8] && !q[9] && q[10]
          if (a) score += 40
          if (b) score += 40
        }
      }
    }
    runs((i, j) => g[i][j])
    runs((i, j) => g[j][i])
    for (let y = 0; y < s - 1; y++)
      for (let x = 0; x < s - 1; x++) {
        const c = g[y][x]
        if (c === g[y][x + 1] && c === g[y + 1][x] && c === g[y + 1][x + 1]) score += 3
      }
    let dark = 0
    for (const row of g) for (const d of row) if (d) dark++
    const total = s * s
    score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
    return score
  }
}

/** Encodes text (UTF-8, byte mode) as a QR code. Throws when it doesn't fit version 10. */
export function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text))
  let version = 1
  for (; version <= MAX_VERSION; version++) {
    const countBits = version < 10 ? 8 : 16
    if (4 + countBits + bytes.length * 8 <= dataCodewords(version) * 8) break
  }
  if (version > MAX_VERSION) throw new Error("QR payload too long")
  const capacity = dataCodewords(version) * 8
  const bits: number[] = []
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, version < 10 ? 8 : 16)
  bytes.forEach((b) => push(b, 8))
  push(0, Math.min(4, capacity - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2))
  const codewords = addEcc(data, version)

  let best: Grid | null = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const g = new Grid(version)
    g.drawPatterns()
    g.placeData(codewords)
    g.applyMask(mask)
    g.format(mask)
    const score = g.penalty()
    if (score < bestScore) {
      best = g
      bestScore = score
    }
  }
  return best!.dark
}
