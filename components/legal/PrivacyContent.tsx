"use client";

import { useTranslation } from "react-i18next";
import { CONTACT_EMAIL } from "../LegalPage";

/** Privacy policy body in the current language. */
export function PrivacyContent() {
  const { i18n } = useTranslation();
  return i18n.language === "en" ? <PrivacyEn /> : <PrivacyTh />;
}

function PrivacyTh() {
  return (
    <>
      <section>
        <p>
          Tookbaht (&quot;แอป&quot;) เป็นแอปบันทึกรายรับรายจ่ายส่วนตัว นโยบายนี้อธิบายว่าเราเก็บข้อมูลอะไร ใช้ทำอะไร เก็บไว้ที่ไหน
          และคุณมีสิทธิ์อะไรบ้างตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
        </p>
      </section>

      <section>
        <h2>1. ข้อมูลที่เราเก็บ</h2>
        <ul>
          <li>
            <b>ข้อมูลบัญชี Google</b> — ชื่อและอีเมลที่ Google ส่งให้ตอนเข้าสู่ระบบ เราไม่ได้รับรหัสผ่านของคุณ
          </li>
          <li>
            <b>ข้อมูลการเงินที่คุณบันทึกเอง</b> — บัญชี ยอดเริ่มต้น รายรับ รายจ่าย การโอน โน้ต subscriptions เป้าหมาย และงบประมาณ
          </li>
          <li>
            <b>การตั้งค่าในแอป</b> — เช่น สถานะการอ่านการแจ้งเตือน และเขตเวลาที่ใช้คำนวณวันตัดบัญชี
          </li>
          <li>
            <b>ข้อมูลการแจ้งเตือน</b> — ถ้าคุณเปิดการแจ้งเตือน เราเก็บรหัสรับแจ้งเตือน (push subscription) ของอุปกรณ์นั้น และชื่อเบราว์เซอร์/อุปกรณ์แบบย่อ
          </li>
        </ul>
        <p>เราไม่เก็บตำแหน่งที่ตั้ง รายชื่อผู้ติดต่อ เลขบัญชีธนาคาร หรือข้อมูลบัตรจริง และไม่เชื่อมต่อกับธนาคารใดๆ</p>
      </section>

      <section>
        <h2>2. เราใช้ข้อมูลเพื่ออะไร</h2>
        <ul>
          <li>ให้คุณเข้าสู่ระบบ และเห็นข้อมูลเดียวกันในทุกอุปกรณ์</li>
          <li>คำนวณยอดคงเหลือ สรุปรายเดือน งบประมาณ และเป้าหมาย</li>
          <li>บันทึกรายจ่ายของ subscriptions อัตโนมัติ และแจ้งเตือนก่อนตัดบัญชีเมื่อคุณเปิดใช้</li>
        </ul>
        <p>
          เราประมวลผลข้อมูลเพื่อให้บริการตามที่คุณใช้งาน (ฐานสัญญา) และตามความยินยอมของคุณสำหรับการแจ้งเตือน
          เราไม่ขายข้อมูล ไม่ใช้ข้อมูลเพื่อโฆษณา และไม่มีตัวติดตามหรือระบบวิเคราะห์การใช้งานจากบุคคลที่สาม
        </p>
      </section>

      <section>
        <h2>3. ข้อมูลเก็บไว้ที่ไหน และใครเข้าถึงได้</h2>
        <ul>
          <li>
            <b>Supabase</b> — ฐานข้อมูลและระบบเข้าสู่ระบบ เซิร์ฟเวอร์อยู่ที่สิงคโปร์ ข้อมูลของแต่ละผู้ใช้แยกกันด้วย Row Level Security
            ผู้ใช้คนอื่นเข้าถึงข้อมูลของคุณไม่ได้
          </li>
          <li>
            <b>Vercel</b> — โฮสต์ตัวแอป
          </li>
          <li>
            <b>Google</b> — ยืนยันตัวตนตอนเข้าสู่ระบบ
          </li>
          <li>
            <b>บริการแจ้งเตือนของเบราว์เซอร์</b> (เช่น Apple, Google) — ส่งข้อความแจ้งเตือนที่เข้ารหัสไปยังอุปกรณ์ของคุณ
          </li>
        </ul>
        <p>ผู้ให้บริการเหล่านี้ประมวลผลข้อมูลแทนเราเพื่อให้แอปทำงานได้เท่านั้น การรับส่งข้อมูลทั้งหมดเข้ารหัสด้วย HTTPS</p>
      </section>

      <section>
        <h2>4. คุกกี้และข้อมูลในเครื่อง</h2>
        <p>
          แอปใช้คุกกี้เฉพาะที่จำเป็นสำหรับการเข้าสู่ระบบ และเก็บไฟล์ของแอปไว้ในเครื่องเพื่อให้เปิดได้เร็วและแสดงหน้าออฟไลน์
          ไม่มีคุกกี้โฆษณาหรือคุกกี้ติดตาม
        </p>
      </section>

      <section>
        <h2>5. ระยะเวลาเก็บข้อมูล</h2>
        <p>
          เราเก็บข้อมูลตราบเท่าที่คุณยังมีบัญชี เมื่อคุณลบบัญชีที่หน้าโปรไฟล์ ข้อมูลทั้งหมดของคุณจะถูกลบออกจากฐานข้อมูลทันทีและกู้คืนไม่ได้
          สำเนาสำรองของผู้ให้บริการอาจยังคงอยู่ช่วงสั้นๆ ตามรอบการสำรองข้อมูลของผู้ให้บริการ
        </p>
      </section>

      <section>
        <h2>6. สิทธิ์ของคุณ</h2>
        <ul>
          <li>ดูและแก้ไขข้อมูลของคุณได้ในแอป</li>
          <li>ส่งออกรายการทั้งหมดเป็นไฟล์ CSV ได้ที่หน้าโปรไฟล์</li>
          <li>ลบบัญชีและข้อมูลทั้งหมดได้ด้วยตัวเองที่หน้าโปรไฟล์</li>
          <li>ปิดการแจ้งเตือนเมื่อไหร่ก็ได้ (ถอนความยินยอม)</li>
          <li>ขอข้อมูล คัดค้าน หรือร้องเรียนเรื่องการใช้ข้อมูลส่วนบุคคลได้ตาม PDPA</li>
        </ul>
      </section>

      <section>
        <h2>7. การเปลี่ยนแปลงนโยบาย</h2>
        <p>หากมีการเปลี่ยนแปลงที่สำคัญ เราจะแจ้งในแอปและปรับวันที่ด้านบนของหน้านี้</p>
      </section>

      <section>
        <h2>8. ติดต่อเรา</h2>
        <p>
          หากมีคำถามเรื่องข้อมูลส่วนบุคคล
          {CONTACT_EMAIL ? (
            <>
              {" "}ติดต่อได้ที่{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
                {CONTACT_EMAIL}
              </a>
            </>
          ) : (
            " ติดต่อผู้ดูแลแอปได้โดยตรง"
          )}
        </p>
      </section>
    </>
  );
}

function PrivacyEn() {
  return (
    <>
      <section>
        <p>
          Tookbaht (&quot;the app&quot;) is a personal income and expense tracker. This policy explains what we collect, what we use it
          for, where it is stored, and your rights under Thailand&apos;s Personal Data Protection Act B.E. 2562 (PDPA).
        </p>
      </section>

      <section>
        <h2>1. What we collect</h2>
        <ul>
          <li>
            <b>Google account details</b> — the name and email Google shares when you sign in. We never receive your password.
          </li>
          <li>
            <b>Money data you enter</b> — accounts, opening balances, income, expenses, transfers, notes, subscriptions, goals and budgets.
          </li>
          <li>
            <b>App settings</b> — such as notification read state, language, and the time zone used for billing dates.
          </li>
          <li>
            <b>Notification data</b> — if you turn on notifications, the device&apos;s push subscription and a short browser/device name.
          </li>
        </ul>
        <p>We don&apos;t collect your location, contacts, real bank account or card numbers, and we don&apos;t connect to any bank.</p>
      </section>

      <section>
        <h2>2. How we use it</h2>
        <ul>
          <li>To sign you in and show the same data on all your devices</li>
          <li>To calculate balances, monthly summaries, budgets and goals</li>
          <li>To log subscription charges automatically and remind you before billing when you turn that on</li>
        </ul>
        <p>
          We process your data to provide the service you use (contract) and, for notifications, with your consent.
          We don&apos;t sell data, use it for advertising, or run third-party trackers or analytics.
        </p>
      </section>

      <section>
        <h2>3. Where it is stored and who can access it</h2>
        <ul>
          <li>
            <b>Supabase</b> — database and sign-in, hosted in Singapore. Each user&apos;s data is isolated with Row Level Security; other
            users can&apos;t access yours.
          </li>
          <li>
            <b>Vercel</b> — hosts the app
          </li>
          <li>
            <b>Google</b> — verifies your identity at sign-in
          </li>
          <li>
            <b>Browser push services</b> (e.g. Apple, Google) — deliver encrypted notifications to your device
          </li>
        </ul>
        <p>These providers process data on our behalf only to run the app. All traffic is encrypted with HTTPS.</p>
      </section>

      <section>
        <h2>4. Cookies and on-device storage</h2>
        <p>
          The app only uses cookies needed to keep you signed in, and stores its own files on your device so it opens quickly and can show
          an offline screen. There are no advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>5. How long we keep data</h2>
        <p>
          We keep your data while you have an account. When you delete your account in Profile, all your data is removed from the database
          immediately and can&apos;t be recovered. Provider backups may keep a copy briefly, according to their backup cycle.
        </p>
      </section>

      <section>
        <h2>6. Your rights</h2>
        <ul>
          <li>See and edit your data in the app</li>
          <li>Export all transactions as CSV from Profile</li>
          <li>Delete your account and all data yourself from Profile</li>
          <li>Turn notifications off at any time (withdraw consent)</li>
          <li>Request access, object, or complain about the use of your personal data under the PDPA</li>
        </ul>
      </section>

      <section>
        <h2>7. Changes to this policy</h2>
        <p>If we make significant changes, we&apos;ll let you know in the app and update the date at the top of this page.</p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>
          Questions about your personal data?
          {CONTACT_EMAIL ? (
            <>
              {" "}Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
                {CONTACT_EMAIL}
              </a>
            </>
          ) : (
            " Contact the app maintainer directly."
          )}
        </p>
      </section>
    </>
  );
}
