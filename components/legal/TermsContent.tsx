"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { CONTACT_EMAIL } from "../LegalPage"

/** Terms of use body in the current language. */
export function TermsContent() {
  const { i18n } = useTranslation()
  return i18n.language === "en" ? <TermsEn /> : <TermsTh />
}

function TermsTh() {
  return (
    <>
      <section>
        <p>
          การเข้าสู่ระบบและใช้งาน Tookbaht (&quot;แอป&quot;) ถือว่าคุณยอมรับข้อกำหนดเหล่านี้ หากไม่ยอมรับ
          โปรดหยุดใช้งานแอป
        </p>
      </section>

      <section>
        <h2>1. แอปนี้คืออะไร</h2>
        <p>
          Tookbaht เป็นเครื่องมือช่วยบันทึกรายรับ รายจ่าย การโอน subscriptions และเป้าหมายการเงินส่วนตัว
          แอปไม่ได้เชื่อมต่อกับธนาคาร ไม่ได้โอนหรือถือเงินแทนคุณ ตัวเลขทั้งหมดมาจากข้อมูลที่คุณบันทึกเอง
        </p>
      </section>

      <section>
        <h2>2. ไม่ใช่คำแนะนำทางการเงิน</h2>
        <p>
          สรุป งบประมาณ การแจ้งเตือน และตัวเลขต่างๆ ในแอปมีไว้ช่วยติดตามเท่านั้น ไม่ใช่คำแนะนำทางการเงิน ภาษี
          หรือการลงทุน โปรดตรวจสอบกับรายการเดินบัญชีจริงของคุณก่อนตัดสินใจเรื่องการเงิน
        </p>
      </section>

      <section>
        <h2>3. บัญชีผู้ใช้</h2>
        <ul>
          <li>เข้าสู่ระบบด้วยบัญชี Google ของคุณ และคุณรับผิดชอบการดูแลความปลอดภัยของบัญชีนั้น</li>
          <li>ข้อมูลที่คุณบันทึกเป็นของคุณ คุณส่งออกหรือลบได้ตลอดเวลาที่หน้าโปรไฟล์</li>
          <li>เมื่อจดว่าเพื่อนติดเงิน ใส่เฉพาะชื่อที่จำเป็น และไม่ใส่ข้อมูลส่วนตัวอื่นของบุคคลอื่น</li>
          <li>
            การเก็บและใช้ข้อมูลเป็นไปตาม{" "}
            <Link href="/privacy" className="font-semibold underline">
              นโยบายความเป็นส่วนตัว
            </Link>
          </li>
        </ul>
      </section>

      <section>
        <h2>4. การใช้งานที่ไม่อนุญาต</h2>
        <ul>
          <li>พยายามเข้าถึงข้อมูลของผู้ใช้อื่น หรือหลีกเลี่ยงระบบความปลอดภัย</li>
          <li>ส่งคำขอจำนวนมากผิดปกติ หรือกระทำการที่ทำให้ระบบทำงานผิดปกติ</li>
          <li>ใช้แอปเพื่อกิจกรรมที่ผิดกฎหมาย</li>
        </ul>
        <p>เราอาจระงับบัญชีที่ละเมิดข้อกำหนดเหล่านี้</p>
      </section>

      <section>
        <h2>5. การให้บริการ</h2>
        <p>
          แอปให้บริการตามสภาพที่เป็นอยู่ เราพยายามให้แอปทำงานได้ต่อเนื่องและข้อมูลถูกต้อง
          แต่ไม่รับประกันว่าจะไม่มีข้อผิดพลาด ไม่หยุดชะงัก หรือการแจ้งเตือนจะถึงตรงเวลาทุกครั้ง เราอาจปรับปรุง เปลี่ยน
          หรือหยุดฟีเจอร์ได้ แนะนำให้สำรองข้อมูลเป็นไฟล์ JSON ที่หน้าโปรไฟล์เก็บไว้เป็นระยะ
        </p>
      </section>

      <section>
        <h2>6. ข้อจำกัดความรับผิด</h2>
        <p>
          เท่าที่กฎหมายอนุญาต เราไม่รับผิดชอบต่อความเสียหายที่เกิดจากการใช้หรือไม่สามารถใช้แอป
          รวมถึงการตัดสินใจทางการเงินที่อาศัยข้อมูลในแอป หรือข้อมูลสูญหายจากเหตุที่อยู่นอกเหนือการควบคุมของเรา
        </p>
      </section>

      <section>
        <h2>7. การยกเลิก</h2>
        <p>
          คุณหยุดใช้งานและขอลบบัญชีได้ทุกเมื่อที่หน้าโปรไฟล์ บัญชีจะถูกปิดทันทีและกู้คืนได้โดยเข้าสู่ระบบภายใน 30 วัน
          เมื่อครบ 30 วัน ข้อมูลทั้งหมดจะถูกลบถาวรและกู้คืนไม่ได้
        </p>
      </section>

      <section>
        <h2>8. การเปลี่ยนแปลงข้อกำหนด</h2>
        <p>
          เราอาจปรับปรุงข้อกำหนดนี้ หากเปลี่ยนแปลงสาระสำคัญจะแจ้งในแอป การใช้งานต่อหลังจากนั้นถือว่ายอมรับข้อกำหนดใหม่
        </p>
      </section>

      <section>
        <h2>9. กฎหมายที่ใช้บังคับ</h2>
        <p>
          ข้อกำหนดนี้อยู่ภายใต้กฎหมายไทย
          {CONTACT_EMAIL ? (
            <>
              {" "}
              หากมีคำถาม ติดต่อ{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
                {CONTACT_EMAIL}
              </a>
            </>
          ) : null}
        </p>
      </section>
    </>
  )
}

function TermsEn() {
  return (
    <>
      <section>
        <p>
          By signing in to and using Tookbaht (&quot;the app&quot;), you agree to these terms. If you don&apos;t agree,
          please stop using the app.
        </p>
      </section>

      <section>
        <h2>1. What the app is</h2>
        <p>
          Tookbaht helps you record income, expenses, transfers, subscriptions and personal money goals. It doesn&apos;t
          connect to banks and never moves or holds money for you. Every number comes from what you enter.
        </p>
      </section>

      <section>
        <h2>2. Not financial advice</h2>
        <p>
          Summaries, budgets, alerts and figures in the app are tracking aids only, not financial, tax or investment
          advice. Check your actual statements before making money decisions.
        </p>
      </section>

      <section>
        <h2>3. Your account</h2>
        <ul>
          <li>You sign in with your Google account and are responsible for keeping it secure.</li>
          <li>The data you enter is yours. You can export or delete it at any time in Profile.</li>
          <li>
            When tracking money friends owe you, enter only the name you need and no other personal details about other
            people.
          </li>
          <li>
            How we collect and use data is described in the{" "}
            <Link href="/privacy" className="font-semibold underline">
              Privacy Policy
            </Link>
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Not allowed</h2>
        <ul>
          <li>Trying to access other users&apos; data or get around security</li>
          <li>Sending unusually large numbers of requests or disrupting the service</li>
          <li>Using the app for anything illegal</li>
        </ul>
        <p>We may suspend accounts that break these terms.</p>
      </section>

      <section>
        <h2>5. The service</h2>
        <p>
          The app is provided as is. We work to keep it running and your data accurate, but can&apos;t guarantee it will
          be error-free, uninterrupted, or that every notification arrives on time. We may improve, change or stop
          features. Backing up your data as a JSON file from Profile from time to time is recommended.
        </p>
      </section>

      <section>
        <h2>6. Limitation of liability</h2>
        <p>
          To the extent the law allows, we aren&apos;t liable for damages from using or being unable to use the app,
          including money decisions based on it or data loss outside our control.
        </p>
      </section>

      <section>
        <h2>7. Ending use</h2>
        <p>
          You can stop using the app and ask to delete your account at any time in Profile. The account closes at once
          and can be restored by signing in within 30 days; after that all data is deleted for good and can&apos;t be
          recovered.
        </p>
      </section>

      <section>
        <h2>8. Changes</h2>
        <p>
          We may update these terms and will let you know in the app about significant changes. Continuing to use the
          app means you accept them.
        </p>
      </section>

      <section>
        <h2>9. Governing law</h2>
        <p>
          These terms are governed by the laws of Thailand.
          {CONTACT_EMAIL ? (
            <>
              {" "}
              Questions? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline">
                {CONTACT_EMAIL}
              </a>
            </>
          ) : null}
        </p>
      </section>
    </>
  )
}
