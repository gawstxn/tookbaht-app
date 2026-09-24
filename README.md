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
- **Subscriptions**: สรุปค่าใช้จ่ายต่อเดือน/ปี แยกหมวด, เรียงตามวันตัดบัญชีหรือราคา, เพิ่ม/แก้ไข/หยุดชั่วคราว/ยกเลิก, บันทึกเป็นรายจ่ายอัตโนมัติเมื่อถึงรอบ (ฐานข้อมูลทำเองทุกชั่วโมงด้วย pg_cron แม้ไม่ได้เปิดแอป), แจ้งเตือนผ่าน Web Push ล่วงหน้า 1 วัน
- **เป้าหมาย**: เป้ารายรับ, งบรายจ่ายรวมและแยกหมวด, เส้นบอก "ควรใช้ถึงวันนี้" เทียบกับความเร็วการใช้จ่าย
- **โปรไฟล์**: จัดการบัญชี (เพิ่ม/แก้ไข/ลบ), ส่งออกข้อมูลเป็น CSV, ออกจากระบบ, ลบบัญชีผู้ใช้และข้อมูลทั้งหมด (มียืนยัน)

ข้อมูลเก็บใน Postgres ของ Supabase แต่ละแถวผูกกับผู้ใช้ (`user_id`) และเปิด Row Level Security ทุกตาราง ผู้ใช้จึงเห็นและแก้ได้เฉพาะข้อมูลของตัวเอง

## โครงสร้าง

```
app/                    หน้าต่างๆ (App Router)
  page.tsx              ภาพรวม
  login/ add/ transactions/ goals/ goals/edit/ profile/ accounts/ onboarding/
  auth/callback/        รับ code จาก Google OAuth แล้วสร้าง session
  api/cron/reminders/   งานรายวัน (Vercel Cron) ส่งแจ้งเตือน subscription ที่จะตัดบัญชีพรุ่งนี้
  subscriptions/        รายการ, new/, [id]/, [id]/edit/
components/
  ui/primitives.tsx     Card, HeroCard, Sheet (bottom sheet), Switch, Segmented, Chip, ปุ่ม ฯลฯ
  ui/Icon.tsx           ไอคอน SVG
  pickers.tsx           Calendar, DateSheet, AccountSheet, CategorySheet, MonthSwitcher
  app.tsx               BottomNav, TabScreen, PushScreen, TxRow
  SubscriptionForm.tsx  ฟอร์มเพิ่ม/แก้ไข subscription
  AccountEditSheet.tsx  ฟอร์มเพิ่ม/แก้ไขบัญชี
  PushToggle.tsx        เปิด/ปิดการแจ้งเตือนบนเครื่องนี้ (หน้าโปรไฟล์)
  AppShell.tsx          ติดตาม session, โหลดข้อมูล, พาไป onboarding, toast เมื่อบันทึกไม่สำเร็จ
lib/
  store.ts              Zustand store + actions (อัปเดตหน้าจอทันที แล้วบันทึกลง Supabase ถ้าล้มเหลวจะย้อนกลับ)
  db.ts                 แปลงแถวในฐานข้อมูล ↔ types ของแอป, โหลดข้อมูลทั้งหมด
  legacyImport.ts       นำเข้าข้อมูลจาก localStorage ของเวอร์ชันเก่า
  supabase/             client ฝั่งเบราว์เซอร์, ฝั่งเซิร์ฟเวอร์ และ admin (service role สำหรับ cron)
  selectors.ts          คำนวณสรุปรายเดือน, ยอดบัญชี, subscriptions ใกล้ถึง, pace
  format.ts             ฟอร์แมตเงิน/วันที่ภาษาไทย (พ.ศ.), คำนวณรอบตัดบัญชี
  constants.ts          หมวดหมู่และสี
  seed.ts               ข้อมูลตัวอย่าง (ยังไม่ได้ใช้แล้ว)
proxy.ts                ต่ออายุ session และพาผู้ที่ยังไม่เข้าสู่ระบบไป /login
supabase/
  config.toml           ตั้งค่า Supabase บนเครื่อง
  migrations/           schema, RLS, trigger สร้างโปรไฟล์, ฟังก์ชันลบบัญชี, auto-log + pg_cron, push subscriptions
vercel.json             ตาราง Vercel Cron
```

Design tokens (สี ฟอนต์ เงา) อยู่ใน `app/globals.css` ใต้ `@theme`

## PWA

- `app/manifest.ts` — web app manifest (ติดตั้งลงหน้าจอหลักได้)
- `public/icons/` — ไอคอน 192/512, maskable และ apple-touch-icon
- `public/sw.js` — service worker: cache ไฟล์ build (`/_next/static`), แสดง `public/offline.html` เมื่อโหลดหน้าไม่ได้ (ไม่ cache ข้อมูลผู้ใช้) และแสดงแจ้งเตือน push แตะแล้วเปิดหน้า subscription นั้น
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
6. ใส่ environment variables ทั้งหมดใน `.env.example` ที่ Vercel → Project → Settings → Environment Variables
   - `SUPABASE_SECRET_KEY`: Supabase → Project Settings → API Keys → Secret key (ห้ามใส่ใน `NEXT_PUBLIC_*`)
   - VAPID: รัน `npx web-push generate-vapid-keys` ครั้งเดียว แล้วใส่ public/private key, `VAPID_SUBJECT=mailto:<อีเมลคุณ>`
   - `CRON_SECRET`: สตริงสุ่มยาวๆ — Vercel แนบเป็น `Authorization: Bearer` ให้ cron อัตโนมัติ

## งานอัตโนมัติ

- **Auto-log**: `log_due_subscriptions()` รันทุกชั่วโมงที่นาที 5 ด้วย pg_cron (สร้างใน migration) ใช้วันที่ตามเขตเวลาของผู้ใช้ (`profiles.timezone`, ค่าเริ่มต้น `Asia/Bangkok`) แอปเรียก `run_my_auto_log()` ตอนโหลดด้วย บันทึกซ้ำไม่ได้เพราะมี unique `(subscription_id, date)`
- **แจ้งเตือน**: Vercel Cron เรียก `/api/cron/reminders` ทุกวัน 02:00 UTC (09:00 น. เวลาไทย) ส่งถึงทุกเครื่องที่เปิดแจ้งเตือนไว้ บันทึกใน `reminders_sent` กันส่งซ้ำ และลบ endpoint ที่เบราว์เซอร์ยกเลิกแล้ว (404/410)
- ทดสอบ cron บนเครื่อง: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders`
- แจ้งเตือนใช้ได้เฉพาะ production build (`npm run build && npm run start`) เพราะ service worker ไม่ลงทะเบียนตอน dev และบน iPhone ต้องติดตั้งแอปลงหน้าจอหลักก่อน (iOS 16.4+)

ใช้ Google login บนเครื่อง: ใส่ `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` ใน `supabase/.env`, เปลี่ยน `[auth.external.google] enabled = true` ใน `supabase/config.toml`, เพิ่ม redirect URI `http://127.0.0.1:55321/auth/v1/callback` ใน Google Console แล้ว `npx supabase stop && npx supabase start`

อย่าลืมเปลี่ยนไอคอนในปุ่มเป็นโลโก้ Google ทางการตาม branding guidelines ของ Google
