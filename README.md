<p align="center">
  <img src="docs/logo.png" alt="Tookbaht" width="112" height="112" />
</p>

<h1 align="center">Tookbaht · ทุกบาท</h1>

<p align="center">
  แอปบันทึกรายรับรายจ่ายบนมือถือ ติดตั้งลงหน้าจอหลักแล้วใช้งานเหมือนแอปจริง<br />
  รายรับ รายจ่าย การโอน รายการประจำ ค่าผ่อน subscriptions และงบประมาณ ครบในที่เดียว
</p>

<p align="center">
  <a href="https://tookbaht.vercel.app">tookbaht.vercel.app</a>
</p>

---

**Stack:** Next.js 16 (App Router, React 19) · TypeScript · Tailwind CSS v4 · Zustand · i18next (ไทย / English) · Supabase (Postgres, Auth, pg_cron) · Web Push · Vercel · Vitest + PGlite

## ฟีเจอร์

**บันทึกเงินประจำวัน**
- รายรับ / รายจ่าย / โอนระหว่างบัญชี ด้วยแป้นตัวเลข แก้ไขและลบได้ พร้อมปุ่มเลิกทำ
- หน้ารายการ: ค้นหา, กรองตามประเภท บัญชี หมวด และช่วงวันที่, จัดกลุ่มตามวัน
- ปรับยอดบัญชีให้ตรงกับยอดจริงในแอปธนาคาร แอปบันทึกส่วนต่างให้

**รายเดือน**
- Subscriptions: โลโก้บริการยอดนิยม, ราคาเป็นบาทหรือ USD (แปลงตามอัตราวันนั้น + ค่าธรรมเนียมบัตร), toggle +VAT 7%
- รายการประจำ: เงินเดือน ค่าเช่า เงินออมรายเดือน ฐานข้อมูลบันทึกให้เองทุกรอบ แม้ไม่ได้เปิดแอป
- ผ่อนเป็นงวด: นับเข้างบในเดือนที่จ่ายแต่ละงวด และหยุดเองเมื่อผ่อนครบ

**บัตรเครดิต / PayLater (เช่น SPayLater)**
- วงเงินคงเหลือจริง: ลดเต็มราคาตั้งแต่วันซื้อ แล้วคืนทีละงวด
- ซื้อแบบผ่อน: ใส่ราคา จำนวนเดือน และยอดต่องวดตามที่แอปที่ซื้อแสดง แอปคำนวณดอกเบี้ยให้
- วันครบกำหนดชำระ, ยอดที่ต้องจ่ายรอบนี้, ปุ่ม "จ่ายบิลแล้ว"

**ภาพรวมและเป้าหมาย**
- ภาพรวมรายเดือน, เป้ารายรับ, งบรวมและงบแยกหมวด พร้อมเส้น "ควรใช้ถึงวันนี้"
- สถิติ: กราฟรายรับ–รายจ่าย 6 เดือน และรายจ่ายตามหมวด
- ศูนย์แจ้งเตือนในแอป และ Web Push: ก่อนตัดบัญชี ก่อนครบกำหนดชำระ และเมื่องบถึง 80% หรือเกิน

**ความเป็นส่วนตัวและการตั้งค่า**
- เข้าสู่ระบบด้วย Google, Row Level Security ทุกตาราง
- ล็อกแอปด้วย PIN 6 หลัก / Face ID บนเครื่อง
- สำรองและกู้คืนข้อมูลเป็น JSON, ส่งออก CSV
- ธีมสว่าง / มืด / ตามระบบ, ภาษาไทย / English

## เริ่มพัฒนาบนเครื่อง

ต้องมี Node 22 และ Docker Desktop (สำหรับ Supabase บนเครื่อง)

```bash
npm install
npx supabase start      # Postgres + Auth บนเครื่อง (พอร์ต 553xx) และรัน migrations ทั้งหมด
npx supabase status     # คัดลอก API_URL / PUBLISHABLE_KEY / SECRET_KEY ไปใส่ .env.local ตาม .env.example
npm run dev
```

เปิด http://localhost:3000 บนมือถือ หรือใช้โหมดมือถือใน DevTools (ออกแบบไว้ที่ 390–430px)

**เข้าสู่ระบบบนเครื่องได้ในคลิกเดียว:** ใส่ `NEXT_PUBLIC_DEV_LOGIN=true` ใน `.env.local` หน้า login จะมีปุ่ม "เข้าสู่ระบบทันที" (ผู้ใช้ `dev@tookbaht.local`) ปุ่มนี้แสดงเฉพาะตอนต่อ Supabase บนเครื่อง จากนั้นหน้า onboarding มีปุ่ม "ลองด้วยข้อมูลตัวอย่าง"

อัปเดตฐานข้อมูลบนเครื่องหลังดึง migration ใหม่: `npx supabase migration up` · รีเซ็ตทั้งหมด: `npx supabase db reset`

### คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | dev server |
| `npm test` | Vitest: unit tests (`tests/unit`) และ database tests (`tests/db`) ที่รัน migrations ทั้งหมดบน Postgres ในหน่วยความจำ (PGlite) ไม่ต้องใช้ Docker |
| `npm run lint` | ESLint |
| `npm run build` | production build (type-check ด้วย) |
| `npm run start` | รัน production build (ใช้ทดสอบ service worker, push และความลื่นของแอนิเมชัน) |

CI (GitHub Actions) รัน lint, test และ build ทุก PR

## โครงสร้าง

```
app/                       หน้าต่างๆ (App Router)
  page.tsx                 ภาพรวม
  add/ transactions/ insights/ goals/ notifications/ profile/ onboarding/ login/
  accounts/ [id]/ [id]/buy/        บัญชี, หน้าบัตร/PayLater, ซื้อแบบผ่อน
  subscriptions/ recurring/new/    subscriptions และรายการประจำ
  api/cron/reminders/      Vercel Cron รายวัน: push แจ้งเตือน + อัปเดตอัตราแลกเปลี่ยน
components/
  ui/primitives.tsx        Card, HeroCard, Sheet, Switch, Segmented, Chip, ปุ่ม
  AppShell.tsx             session, โหลดข้อมูล, page transitions, toast, ล็อกแอป
  app.tsx                  BottomNav, TabScreen, PushScreen, TxRow, TxIcon
  pickers.tsx              ปฏิทิน, เลือกบัญชี/หมวด/เดือน
lib/
  store.ts                 Zustand store: อัปเดตหน้าจอทันที แล้วบันทึกลง Supabase (ย้อนกลับถ้าล้มเหลว)
  db.ts                    แปลงแถวในฐานข้อมูล ↔ types, โหลดข้อมูลทั้งหมด
  selectors.ts             ยอดรวม ยอดบัญชี วงเงิน วันครบกำหนด งวดผ่อน ตัวกรอง (pure functions, มี tests)
  format.ts money.ts fx.ts วันที่ พ.ศ., รอบตัดบัญชี, เงินบาท/USD
  locales/th.ts en.ts      ข้อความทุกภาษา
  theme.ts appLock.ts nav.ts  ธีม, ล็อกแอป, การย้อนกลับพร้อมแอนิเมชัน
supabase/migrations/       schema, RLS, auto-log (pg_cron), push, รายการประจำ, PayLater
tests/                     unit และ database tests
```

## Deploy (production)

- Vercel deploy `main` อัตโนมัติ
- migration ใหม่: รัน `npx supabase db push` พร้อมกับตอน merge (โปรเจกต์ link ไว้แล้ว)
- ตั้งค่าครั้งแรก: สร้างโปรเจกต์ Supabase (Singapore), เปิด Google provider (redirect URI `https://<ref>.supabase.co/auth/v1/callback`), ตั้ง Site URL / Redirect URLs เป็นโดเมนของแอป และใส่ environment variables ตาม `.env.example` ใน Vercel
- **ห้ามตั้ง `NEXT_PUBLIC_DEV_LOGIN` บน production** และปิด Email provider ให้เหลือแค่ Google

## งานอัตโนมัติ

- **Auto-log** (pg_cron ทุกชั่วโมง): บันทึก subscriptions รายการประจำ และงวดผ่อนที่ถึงกำหนดตามเขตเวลาของผู้ใช้ ไม่บันทึกย้อนหลัง และไม่บันทึกซ้ำ
- **Push** (Vercel Cron 09:00 น.): ตัดบัญชีพรุ่งนี้, ครบกำหนดชำระพรุ่งนี้, งบถึง 80% / เกินงบ แต่ละเรื่องส่งครั้งเดียว
- Push ใช้ได้เฉพาะ production build และบน iPhone ต้องติดตั้งแอปลงหน้าจอหลักก่อน (iOS 16.4+)

## เครดิต

- โลโก้บริการ subscription จาก [Simple Icons](https://simpleicons.org) (CC0) ชื่อและโลโก้เป็นเครื่องหมายการค้าของเจ้าของ ใช้เพื่อบอกว่าเป็นบริการไหนเท่านั้น
- ฟอนต์ IBM Plex Sans Thai, IBM Plex Mono, Noto Serif Thai
