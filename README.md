# ทุกบาท — บันทึกรายรับรายจ่าย

Mobile-first web app สำหรับบันทึกรายรับ รายจ่าย การโอนระหว่างบัญชี จัดการ subscriptions รายเดือน และตั้งเป้าหมายการเงิน

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Zustand

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 บนมือถือหรือ DevTools โหมดมือถือ (ออกแบบที่ความกว้าง 390px, จำกัดความกว้างสูงสุด 430px)

## ฟีเจอร์

- **เข้าสู่ระบบด้วย Google อย่างเดียว** (เวอร์ชันนี้เป็น local profile — ดูหัวข้อ "ต่อ Google login จริง")
- **ภาพรวมรายเดือน**: ยอดคงเหลือ, รายรับเทียบเป้า, รายจ่ายเทียบงบ, subscriptions ใกล้ตัดบัญชี, รายการล่าสุด, เลือกเดือนย้อนหลังได้ 12 เดือน
- **เพิ่มรายการ**: รายรับ / รายจ่าย / โอน พร้อมแป้นตัวเลข, เลือกบัญชีและวันที่ผ่าน bottom sheet, สลับบัญชีต้นทาง–ปลายทาง
- **รายการทั้งหมด**: กรองตามประเภท, ค้นหา, จัดกลุ่มตามวัน, แตะดูรายละเอียดและลบได้
- **Subscriptions**: สรุปค่าใช้จ่ายต่อเดือน/ปี แยกหมวด, เรียงตามวันตัดบัญชีหรือราคา, เพิ่ม/แก้ไข/หยุดชั่วคราว/ยกเลิก, บันทึกเป็นรายจ่ายอัตโนมัติเมื่อถึงรอบ
- **เป้าหมาย**: เป้ารายรับ, งบรายจ่ายรวมและแยกหมวด, เส้นบอก "ควรใช้ถึงวันนี้" เทียบกับความเร็วการใช้จ่าย
- **โปรไฟล์**: ยอดคงเหลือแต่ละบัญชี, ส่งออกข้อมูลเป็น CSV, ออกจากระบบ, ลบบัญชี (มียืนยัน)

ข้อมูลทั้งหมดเก็บใน `localStorage` ของเบราว์เซอร์ (key `tookbaht-v1`) การเข้าสู่ระบบครั้งแรกจะใส่ข้อมูลตัวอย่างให้

## โครงสร้าง

```
app/                    หน้าต่างๆ (App Router)
  page.tsx              ภาพรวม
  login/ add/ transactions/ goals/ goals/edit/ profile/
  subscriptions/        รายการ, new/, [id]/, [id]/edit/
components/
  ui/primitives.tsx     Card, HeroCard, Sheet (bottom sheet), Switch, Segmented, Chip, ปุ่ม ฯลฯ
  ui/Icon.tsx           ไอคอน SVG
  pickers.tsx           Calendar, DateSheet, AccountSheet, CategorySheet, MonthSwitcher
  app.tsx               BottomNav, TabScreen, PushScreen, TxRow
  SubscriptionForm.tsx  ฟอร์มเพิ่ม/แก้ไข subscription
  AppShell.tsx          โหลดข้อมูลจาก localStorage + guard เส้นทาง login
lib/
  store.ts              Zustand store + actions (persist)
  selectors.ts          คำนวณสรุปรายเดือน, ยอดบัญชี, subscriptions ใกล้ถึง, pace
  format.ts             ฟอร์แมตเงิน/วันที่ภาษาไทย (พ.ศ.), คำนวณรอบตัดบัญชี
  constants.ts          หมวดหมู่และสี
  seed.ts               ข้อมูลตัวอย่าง
```

Design tokens (สี ฟอนต์ เงา) อยู่ใน `app/globals.css` ใต้ `@theme`

## ต่อ Google login จริง

แก้ `handleGoogle` ใน `app/login/page.tsx`:

- **Auth.js:** ติดตั้ง `next-auth`, ตั้ง Google provider แล้วเรียก `signIn("google")` จากนั้นนำชื่อ/อีเมลจาก session ไปเรียก `useStore.getState().signIn({ name, email })`
- **Supabase:** `supabase.auth.signInWithOAuth({ provider: "google" })`

อย่าลืมเปลี่ยนไอคอนในปุ่มเป็นโลโก้ Google ทางการตาม branding guidelines ของ Google

ถ้าต้องการซิงก์ข้าม device ให้ย้าย actions ใน `lib/store.ts` ไปเรียก API/ฐานข้อมูลแทน localStorage — หน้าจอทั้งหมดอ่านข้อมูลผ่าน store อย่างเดียว
