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
            คุณเปลี่ยนชื่อที่แสดงได้ และเลือกรูปโปรไฟล์จากชุดที่แอปมีให้ (แอปไม่รับอัปโหลดรูป เก็บแค่ว่าคุณเลือกรูปไหน)
          </li>
          <li>
            <b>ข้อมูลการเงินที่คุณบันทึกเอง</b> — บัญชี ยอดเริ่มต้น วงเงินและวันครบกำหนดชำระของบัตร/PayLater รายรับ รายจ่าย การโอน โน้ต
            subscriptions รายการประจำ รายการผ่อน (ราคาสินค้า จำนวนงวด ยอดต่องวด) เป้าหมาย งบประมาณ เป้าหมายเก็บเงิน แท็กทริป/โปรเจกต์ที่คุณตั้งเอง และประเภทค่าลดหย่อนภาษีที่คุณติดป้ายไว้กับรายจ่าย
          </li>
          <li>
            <b>รายการติดเงินกับเพื่อน</b> — ชื่อเพื่อนที่คุณพิมพ์เอง จำนวนเงิน โน้ต ทิศทาง (เพื่อนติดคุณ หรือคุณติดเพื่อน) วันที่คืน และชื่อเพื่อนที่หาร subscription หรือรายการประจำกับคุณ ใช้เพื่อจดการยืม-คืนเท่านั้น
            เราไม่ติดต่อหรือส่งอะไรถึงคนเหล่านั้น แนะนำให้ใส่แค่ชื่อเล่นที่คุณจำได้
          </li>
          <li>
            <b>รายการอยากได้</b> — ชื่อของ ราคา โน้ต วันที่จะตัดสินใจ และผลว่าซื้อหรือไม่ซื้อ ใช้แสดงรายการและยอดที่ห้ามใจได้เท่านั้น
          </li>
          <li>
            <b>การจดต่อเนื่อง</b> — วันที่คุณยืนยันว่าไม่ได้ใช้เงิน และสรุปความต่อเนื่อง (จำนวนวัน วันล่าสุดที่นับ สิทธิ์กู้ที่เหลือ) ใช้นับความต่อเนื่อง ระดับ และข้อความแจ้งเตือนตอนค่ำเท่านั้น ส่วนวันที่จดรายการ แอปคำนวณจากรายการที่มีอยู่แล้ว
          </li>
          <li>
            <b>ข้อความแจ้งปัญหา</b> — ถ้าคุณส่งจากหน้าโปรไฟล์ เราเก็บข้อความ เวอร์ชันแอป หน้าที่เปิดล่าสุด และชื่อรุ่นเบราว์เซอร์
          </li>
          <li>
            <b>การตั้งค่าในแอป</b> — เช่น สถานะการอ่านการแจ้งเตือน เขตเวลาที่ใช้คำนวณวันตัดบัญชี หมวดหมู่ที่คุณสร้างเอง และรายการที่คุณบอกว่าไม่ใช่บิลรายเดือน
          </li>
          <li>
            <b>พร้อมเพย์ของคุณ</b> — ถ้าคุณตั้งไว้ เราเก็บเบอร์มือถือ เลขบัตรประชาชน หรือเลข e-Wallet ที่คุณใส่ เพื่อสร้าง QR ให้เพื่อนสแกนจ่ายคืนเท่านั้น
            QR สร้างบนอุปกรณ์ของคุณ และเลขนี้จะอยู่ใน QR ที่คุณแชร์ให้คนอื่น ลบได้ทุกเมื่อที่ โปรไฟล์ → พร้อมเพย์ของฉัน
          </li>
          <li>
            <b>ข้อมูลการแจ้งเตือน</b> — ถ้าคุณเปิดการแจ้งเตือน เราเก็บรหัสรับแจ้งเตือน (push subscription) ของอุปกรณ์นั้น และชื่อเบราว์เซอร์/อุปกรณ์แบบย่อ
          </li>
          <li>
            <b>สถานะการลบบัญชี</b> — วันที่คุณขอลบบัญชี เพื่อให้กู้คืนได้ภายใน 30 วัน
          </li>
        </ul>
        <p>
          PIN และ Face ID ของล็อกแอปอยู่บนอุปกรณ์ของคุณเท่านั้น PIN เก็บเป็นค่าแฮช ส่วน Face ID ใช้พาสคีย์ของอุปกรณ์
          ข้อมูลใบหน้าไม่เคยออกจากอุปกรณ์และเราไม่ได้รับ
        </p>
        <p>เราไม่เก็บตำแหน่งที่ตั้ง รายชื่อผู้ติดต่อ เลขบัญชีธนาคาร หรือข้อมูลบัตรจริง และไม่เชื่อมต่อกับธนาคารใดๆ</p>
      </section>

      <section>
        <h2>2. เราใช้ข้อมูลเพื่ออะไร</h2>
        <ul>
          <li>ให้คุณเข้าสู่ระบบ และเห็นข้อมูลเดียวกันในทุกอุปกรณ์</li>
          <li>คำนวณยอดคงเหลือ สรุปรายเดือน งบประมาณ และเป้าหมาย</li>
          <li>บันทึก subscriptions รายการประจำ และงวดผ่อนให้อัตโนมัติเมื่อถึงกำหนด</li>
          <li>แจ้งเตือนก่อนตัดบัญชี ก่อนวันครบกำหนดชำระ เมื่องบใกล้เต็มหรือเกิน สรุปของเดือนที่แล้วในต้นเดือน และเตือนให้จดรายการตอนค่ำถ้าวันนั้นยังไม่ได้จด (เฉพาะเมื่อคุณเปิดไว้)</li>
          <li>อ่านข้อความแจ้งปัญหาเพื่อแก้ไขและปรับปรุงแอป</li>
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
          แอปใช้คุกกี้เฉพาะที่จำเป็นสำหรับการเข้าสู่ระบบ เก็บไฟล์ของแอปไว้ในเครื่องเพื่อให้เปิดได้เร็วและแสดงหน้าออฟไลน์
          และเก็บการตั้งค่าเฉพาะเครื่องไว้ในเบราว์เซอร์ ได้แก่ ธีม ภาษา ล็อกแอป และการซ่อนยอดเงิน ไม่มีคุกกี้โฆษณาหรือคุกกี้ติดตาม
          เพื่อให้เปิดแอปและจดรายการได้ตอนไม่มีอินเทอร์เน็ต แอปเก็บสำเนาข้อมูลของคุณล่าสุด และรายการที่จดตอนออฟไลน์ซึ่งรอส่งขึ้นเซิร์ฟเวอร์
          ไว้ในเบราว์เซอร์ของอุปกรณ์นั้น รวมถึงการหารทริปที่ยังไม่ได้บันทึก (ชื่อเพื่อนและบิลที่เพื่อนจ่าย) ทั้งหมดนี้ถูกลบเมื่อคุณออกจากระบบ ส่วนรูปสลิปที่ใช้ &quot;อ่านสลิป&quot; จะถูกอ่านบนอุปกรณ์ของคุณเท่านั้น ไม่ถูกส่งขึ้นเซิร์ฟเวอร์และไม่ถูกเก็บไว้
        </p>
      </section>

      <section>
        <h2>5. ระยะเวลาเก็บข้อมูล</h2>
        <p>
          เราเก็บข้อมูลตราบเท่าที่คุณยังมีบัญชี (รวมถึงข้อความแจ้งปัญหา) เมื่อคุณขอลบบัญชีที่หน้าโปรไฟล์ (ต้องยืนยันตัวตนด้วย Google อีกครั้ง)
          บัญชีจะถูกปิดทันที การแจ้งเตือนหยุด และข้อมูลจะถูกเก็บไว้อีก 30 วันเพื่อให้คุณกู้คืนได้โดยเข้าสู่ระบบอีกครั้ง
          เมื่อครบ 30 วัน ข้อมูลทั้งหมดของคุณจะถูกลบออกจากฐานข้อมูลโดยอัตโนมัติและกู้คืนไม่ได้
          สำเนาสำรองของผู้ให้บริการอาจยังคงอยู่ช่วงสั้นๆ ตามรอบการสำรองข้อมูลของผู้ให้บริการ
        </p>
      </section>

      <section>
        <h2>6. สิทธิ์ของคุณ</h2>
        <ul>
          <li>ดูและแก้ไขข้อมูลของคุณได้ในแอป</li>
          <li>ส่งออกรายการเป็นไฟล์ CSV หรือสำรองข้อมูลทั้งหมดเป็นไฟล์ JSON ได้ที่หน้าโปรไฟล์</li>
          <li>ลบบัญชีและข้อมูลทั้งหมดได้ด้วยตัวเองที่หน้าโปรไฟล์ (ลบถาวรหลัง 30 วัน และกู้คืนได้ระหว่างนั้น)</li>
          <li>ปิดการแจ้งเตือนหรือเฉพาะสรุปสิ้นเดือนเมื่อไหร่ก็ได้ (ถอนความยินยอม)</li>
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
            You can change the display name and pick a profile picture from the app&apos;s own set (nothing is uploaded; we only keep which one you chose).
          </li>
          <li>
            <b>Money data you enter</b> — accounts, opening balances, card / pay-later limits and due days, income, expenses, transfers, notes,
            subscriptions, recurring entries, installment purchases (price, number and amount of installments), goals, budgets, savings goals, the trip / project tags you create, and the tax deduction kinds you mark on expenses.
          </li>
          <li>
            <b>Money owed with friends</b> — the names you type, amounts, notes, who owes whom, when it was paid back, and the friends you share a subscription or recurring bill with, used only to track what&apos;s lent and borrowed. We never
            contact or send anything to these people; we suggest using just a nickname you&apos;ll recognise.
          </li>
          <li>
            <b>Wishlist</b> — what you want, its price, your note, the day to decide and whether you bought it, used only to show the list and what you held back.
          </li>
          <li>
            <b>Streak</b> — the days you confirm you spent nothing and a streak summary (its length, the latest day counted, restores left), used only for your streak, tier and the evening reminder. Days you logged entries are worked out from the entries you already have.
          </li>
          <li>
            <b>Problem reports</b> — if you send one from Profile, the message, app version, last screen you opened and your browser version.
          </li>
          <li>
            <b>App settings</b> — such as notification read state, language, the time zone used for billing dates, categories you create, and suggestions you marked
            as not a monthly bill.
          </li>
          <li>
            <b>Your PromptPay ID</b> — if you set one, the mobile number, national ID or e-wallet ID you enter, used only to make QR codes friends scan to pay you back.
            The QR is made on your device, and the ID is inside any QR you share. Remove it any time in Profile → My PromptPay.
          </li>
          <li>
            <b>Notification data</b> — if you turn on notifications, the device&apos;s push subscription and a short browser/device name.
          </li>
          <li>
            <b>Account deletion status</b> — when you asked to delete your account, so it can be restored within 30 days.
          </li>
        </ul>
        <p>
          The app lock&apos;s PIN and Face ID stay on your device. The PIN is stored as a hash; Face ID uses the device&apos;s passkey, so
          face data never leaves the device and we never receive it.
        </p>
        <p>We don&apos;t collect your location, contacts, real bank account or card numbers, and we don&apos;t connect to any bank.</p>
      </section>

      <section>
        <h2>2. How we use it</h2>
        <ul>
          <li>To sign you in and show the same data on all your devices</li>
          <li>To calculate balances, monthly summaries, budgets and goals</li>
          <li>To log subscriptions, recurring entries and installments automatically when they fall due</li>
          <li>
            With notifications on, to remind you before bills and payment due dates, when a budget nears or passes its limit, and with last
            month&apos;s summary early in the month, and an evening reminder to log when you haven&apos;t that day (only if you turn it on)
          </li>
          <li>To read problem reports so we can fix and improve the app</li>
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
          The app only uses cookies needed to keep you signed in, stores its own files on your device so it opens quickly and can show an
          offline screen, and keeps per-device settings (theme, language, the app lock and hiding amounts) in the browser. There are no advertising or
          tracking cookies. So the app opens and you can log entries without a connection, it also keeps a copy of your latest data, and
          entries made offline that are waiting to be sent, in that device&apos;s browser, along with any trip split you haven&apos;t saved yet
          (friends&apos; names and the bills they paid). All of this is removed when you sign out. Slip photos used with &quot;Read a slip&quot; are read on your device only; they are never uploaded or kept.
        </p>
      </section>

      <section>
        <h2>5. How long we keep data</h2>
        <p>
          We keep your data, including problem reports, while you have an account. When you ask to delete your account in Profile (after confirming with Google), the
          account is closed at once and notifications stop, and your data is kept for 30 more days so you can restore it by signing in.
          After 30 days all your data is removed from the database automatically and can&apos;t be recovered. Provider backups may keep a
          copy briefly, according to their backup cycle.
        </p>
      </section>

      <section>
        <h2>6. Your rights</h2>
        <ul>
          <li>See and edit your data in the app</li>
          <li>Export transactions as CSV, or back up all your data as a JSON file, from Profile</li>
          <li>Delete your account and all data yourself from Profile (deleted for good after 30 days; restorable until then)</li>
          <li>Turn notifications, or just the monthly summary, off at any time (withdraw consent)</li>
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
