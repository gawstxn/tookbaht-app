# ทุกบาท — บันทึกรายรับรายจ่าย

Mobile-first web app สำหรับบันทึกรายรับ รายจ่าย การโอนระหว่างบัญชี จัดการ subscriptions รายเดือน และตั้งเป้าหมายการเงิน

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Zustand · Supabase (Postgres + Auth)

## เริ่มใช้งาน

ต้องมี Docker Desktop สำหรับ Supabase บนเครื่อง

```bash
npm install
npx supabase start      # Postgres + Auth บนเครื่อง (พอร์ต 553xx) และรัน migrations
npx supabase status     # คัดลอก API_URL / PUBLISHABLE_KEY ไปใส่ .env.local ตาม .env.example
npm run dev
```

รีเซ็ตฐานข้อมูลบนเครื่อง: `npx supabase db reset` (ลบข้อมูลทั้งหมดแล้วรัน migrations ใหม่)

เปิด http://localhost:3000 บนมือถือหรือ DevTools โหมดมือถือ (ออกแบบที่ความกว้าง 390px, จำกัดความกว้างสูงสุด 430px)

## ฟีเจอร์

- **เข้าสู่ระบบด้วย Google อย่างเดียว** ผ่าน Supabase Auth
- **เริ่มต้นใช้งาน**: เลือกบัญชีเริ่มต้น หรือนำเข้าข้อมูลจากเวอร์ชันเก่าที่เก็บใน `localStorage`
- **ภาพรวมรายเดือน**: ยอดคงเหลือ, รายรับเทียบเป้า, รายจ่ายเทียบงบ, subscriptions ใกล้ตัดบัญชี, รายการล่าสุด, เลือกเดือนย้อนหลังได้ 12 เดือน
- **เพิ่มรายการ**: รายรับ / รายจ่าย / โอน พร้อมแป้นตัวเลข, เลือกบัญชีและวันที่ผ่าน bottom sheet, สลับบัญชีต้นทาง–ปลายทาง
- **รายการทั้งหมด**: กรองตามประเภท, ค้นหา, จัดกลุ่มตามวัน, แตะดูรายละเอียดและลบได้
- **Subscriptions**: สรุปค่าใช้จ่ายต่อเดือน/ปี แยกหมวด, เรียงตามวันตัดบัญชีหรือราคา, เพิ่ม/แก้ไข/หยุดชั่วคราว/ยกเลิก, บันทึกเป็นรายจ่ายอัตโนมัติเมื่อถึงรอบ
- **เป้าหมาย**: เป้ารายรับ, งบรายจ่ายรวมและแยกหมวด, เส้นบอก "ควรใช้ถึงวันนี้" เทียบกับความเร็วการใช้จ่าย
- **โปรไฟล์**: จัดการบัญชี (เพิ่ม/แก้ไข/ลบ), ส่งออกข้อมูลเป็น CSV, ออกจากระบบ, ลบบัญชีผู้ใช้และข้อมูลทั้งหมด (มียืนยัน)

ข้อมูลเก็บใน Postgres ของ Supabase แต่ละแถวผูกกับผู้ใช้ (`user_id`) และเปิด Row Level Security ทุกตาราง ผู้ใช้จึงเห็นและแก้ได้เฉพาะข้อมูลของตัวเอง

## โครงสร้าง

```
app/                    หน้าต่างๆ (App Router)
  page.tsx              ภาพรวม
  login/ add/ transactions/ goals/ goals/edit/ profile/ accounts/ onboarding/
  auth/callback/        รับ code จาก Google OAuth แล้วสร้าง session
  subscriptions/        รายการ, new/, [id]/, [id]/edit/
components/
  ui/primitives.tsx     Card, HeroCard, Sheet (bottom sheet), Switch, Segmented, Chip, ปุ่ม ฯลฯ
  ui/Icon.tsx           ไอคอน SVG
  pickers.tsx           Calendar, DateSheet, AccountSheet, CategorySheet, MonthSwitcher
  app.tsx               BottomNav, TabScreen, PushScreen, TxRow
  SubscriptionForm.tsx  ฟอร์มเพิ่ม/แก้ไข subscription
  AccountEditSheet.tsx  ฟอร์มเพิ่ม/แก้ไขบัญชี
  AppShell.tsx          ติดตาม session, โหลดข้อมูล, พาไป onboarding, toast เมื่อบันทึกไม่สำเร็จ
lib/
  store.ts              Zustand store + actions (อัปเดตหน้าจอทันที แล้วบันทึกลง Supabase ถ้าล้มเหลวจะย้อนกลับ)
  db.ts                 แปลงแถวในฐานข้อมูล ↔ types ของแอป, โหลดข้อมูลทั้งหมด
  legacyImport.ts       นำเข้าข้อมูลจาก localStorage ของเวอร์ชันเก่า
  supabase/             client ฝั่งเบราว์เซอร์และฝั่งเซิร์ฟเวอร์
  selectors.ts          คำนวณสรุปรายเดือน, ยอดบัญชี, subscriptions ใกล้ถึง, pace
  format.ts             ฟอร์แมตเงิน/วันที่ภาษาไทย (พ.ศ.), คำนวณรอบตัดบัญชี
  constants.ts          หมวดหมู่และสี
  seed.ts               ข้อมูลตัวอย่าง (ยังไม่ได้ใช้แล้ว)
proxy.ts                ต่ออายุ session และพาผู้ที่ยังไม่เข้าสู่ระบบไป /login
supabase/
  config.toml           ตั้งค่า Supabase บนเครื่อง
  migrations/           schema, RLS, trigger สร้างโปรไฟล์, ฟังก์ชันลบบัญชี
```

Design tokens (สี ฟอนต์ เงา) อยู่ใน `app/globals.css` ใต้ `@theme`

## PWA

- `app/manifest.ts` — web app manifest (ติดตั้งลงหน้าจอหลักได้)
- `public/icons/` — ไอคอน 192/512, maskable และ apple-touch-icon
- `public/sw.js` — service worker: cache ไฟล์ build (`/_next/static`) และแสดง `public/offline.html` เมื่อโหลดหน้าไม่ได้ ไม่ cache ข้อมูลผู้ใช้
- `components/ServiceWorkerRegister.tsx` — ลงทะเบียน SW เฉพาะ production build

ทดสอบ: `npm run build && npm run start` แล้วเปิด DevTools → Application → Service workers / Manifest จากนั้นติ๊ก Offline แล้วรีโหลดจะเห็นหน้าออฟไลน์ ถ้าแก้ `sw.js` ในส่วนที่เกี่ยวกับ cache ให้เปลี่ยน `VERSION` เพื่อล้าง cache เก่า

## ตั้งค่า Supabase + Google login (production)

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (แนะนำ region Singapore)
2. รัน migrations ขึ้นโปรเจกต์: `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push`
3. Google Cloud Console → APIs & Services → Credentials → สร้าง OAuth client ID (Web application)
   - Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`
4. Supabase Dashboard → Authentication → Sign In / Providers → Google: ใส่ Client ID และ Client Secret
5. Supabase Dashboard → Authentication → URL Configuration
   - Site URL: โดเมนของแอป เช่น `https://tookbaht.vercel.app`
   - Redirect URLs: `https://<โดเมน>/auth/callback` และ `http://localhost:3000/auth/callback`
6. ใส่ `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ใน Vercel → Project → Settings → Environment Variables

ใช้ Google login บนเครื่อง: ใส่ `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` ใน `supabase/.env`, เปลี่ยน `[auth.external.google] enabled = true` ใน `supabase/config.toml`, เพิ่ม redirect URI `http://127.0.0.1:55321/auth/v1/callback` ใน Google Console แล้ว `npx supabase stop && npx supabase start`

อย่าลืมเปลี่ยนไอคอนในปุ่มเป็นโลโก้ Google ทางการตาม branding guidelines ของ Google
