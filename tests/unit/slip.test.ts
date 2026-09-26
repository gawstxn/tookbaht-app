import { describe, expect, it } from "vitest";
import { findAmount, findDate, parseSlip } from "@/lib/slip";

const TODAY = "2026-09-26";

describe("reading transfer slips", () => {
  it("reads a K PLUS style slip", () => {
    const text = `โอนเงินสำเร็จ
26 ก.ย. 69 14:32 น.
นาย สมชาย ใจดี
ธ.กสิกรไทย
xxx-x-x1234-x
นาย บอส รักเพื่อน
ธ.ไทยพาณิชย์
xxx-x-x5678-x
จำนวน:
1,250.00 บาท
ค่าธรรมเนียม:
0.00 บาท
บันทึกช่วยจำ: ค่าหมูกระทะ`;
    expect(parseSlip(text, TODAY)).toEqual({ amount: 1250, date: "2026-09-26", receiver: "นาย บอส รักเพื่อน", memo: "ค่าหมูกระทะ" });
  });

  it("reads an SCB style slip with a full year and a shop", () => {
    const text = `โอนเงินสำเร็จ
25 ก.ย. 2569 - 09:15
จาก นาย สมชาย ใจดี
ไปยัง ร้านกาแฟดี
จำนวนเงิน 65.00`;
    expect(parseSlip(text, TODAY)).toMatchObject({ amount: 65, date: "2026-09-25", receiver: "ร้านกาแฟดี" });
  });

  it("copes with dots OCR dropped and English slips", () => {
    expect(findDate("24 กย 69 20:01", TODAY)).toBe("2026-09-24");
    expect(findDate("Transfer successful 03 Sep 2026 10:00", TODAY)).toBe("2026-09-03");
    expect(findDate("วันที่ 01/09/2569", TODAY)).toBe("2026-09-01");
    expect(findDate("26 ธันวาคม 2568", TODAY)).toBe("2025-12-26");
  });

  it("prefers the labelled amount over other numbers and skips fees", () => {
    expect(findAmount("ค่าธรรมเนียม 10.00 บาท\nยอดเงิน 12,500.50 บาท\nเลขที่รายการ 2026.09")).toBe(12500.5);
    expect(findAmount("Amount 99.00 THB")).toBe(99);
  });

  it("drops a date in the future and leaves out what isn't there", () => {
    expect(parseSlip("27 ก.ย. 69\nจำนวน 50.00 บาท", TODAY)).toEqual({ amount: 50, date: undefined, receiver: undefined, memo: undefined });
    expect(parseSlip("ภาพไม่ชัด", TODAY)).toEqual({ amount: undefined, date: undefined, receiver: undefined, memo: undefined });
  });

  it("puts back an \"ำ\" that OCR split in two", () => {
    expect(parseSlip("บันทึกช่วยจํา: ค่าหมูกระทะ\nจำนวน 10.00 บาท", TODAY).memo).toBe("ค่าหมูกระทะ");
  });

  it("reads what OCR actually made of a K PLUS slip", () => {
    const ocr = "โอนเงินส\u0e4d\u0e32เร็จ\n\n26 กุย. 69 14:32 น.\nนาย สมชาย ใจดคี\n\nธ.กสิกรไทย\n\n2\u0e50\u0e50\u0e50%-1234-%\n\nนาย บอส รักเพื่อน\n\nธ.โทยพาณิชย์\n\nจ\u0e4d\u0e32นวน:\n\n1,250.00 บาท\nค่าธรรมเนียม:\n\n0.00 บาท\n\nบันทึกช่วยจ\u0e4d\u0e32: ค่าหมูกระทะ\n";
    expect(parseSlip(ocr, TODAY)).toEqual({ amount: 1250, date: "2026-09-26", receiver: "นาย บอส รักเพื่อน", memo: "ค่าหมูกระทะ" });
  });
  it("reads OCR output of SCB, Krungthai and shop QR slips", () => {
    const cases: Record<string, [string, Record<string, unknown>]> = {
    "scb": ["25 \u0e01.\u0e22. 2569 - 09:15\n\n\u0e23\u0e2b\u0e31\u0e2a\u0e2d\u0e49\u0e32\u0e07\u0e2d\u0e34\u0e07: 202609250915486\n\u0e08\u0e32\u0e01\n\n\u0e19\u0e32\u0e22 \u0e2a\u0e21\u0e0a\u0e32\u0e22 \u0e43\u0e08\u0e14\u0e35\n\n20\u0e50\u0e536\u0e50\u0e50123-4\n\n\u0e44\u0e1b\u0e22\u0e31\u0e07\n\n\u0e23\u0e49\u0e32\u0e19\u0e01\u0e32\u0e41\u0e1f\u0e14\u0e35\n\n2\u0e500\u0e50\u0e53\u0e50\u0e50\u0e5087-6\n\n\u0e08\u0e4d\u0e32\u0e19\u0e27\u0e19\u0e40\u0e07\u0e34\u0e19\n\n65.00\n", {"amount": 65, "date": "2026-09-25", "receiver": "ร้านกาแฟดี"}],
    "ktb": ["\u0e42\u0e2d\u0e19\u0e40\u0e07\u0e34\u0e19\u0e2a\u0e4d\u0e32\u0e40\u0e23\u0e47\u0e08\n\n\u0e08\u0e4d\u0e32\u0e19\u0e27\u0e19\u0e40\u0e07\u0e34\u0e19\n\n500.00 \u0e1a\u0e32\u0e17\n\n\u0e04\u0e48\u0e32\u0e18\u0e23\u0e23\u0e21\u0e40\u0e19\u0e35\u0e22\u0e21 0.00 \u0e1a\u0e32\u0e17\n\n\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e17\u0e4d\u0e32\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 24 \u0e01.\u0e38\u0e22. 2569 20:01\n\u0e08\u0e32\u0e01 \u0e19\u0e32\u0e22 \u0e2a\u0e21\u0e0a\u0e32\u0e22 \u0e43\u0e08\u0e14\u0e35\n\n\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a \u0e19\u0e32\u0e07\u0e2a\u0e32\u0e27 \u0e21\u0e34\u0e19\u0e15\u0e23\u0e32 \u0e2a\u0e27\u0e22\u0e07\u0e32\u0e21\n\n\u0e23\u0e2b\u0e31\u0e2a\u0e2d\u0e49\u0e32\u0e07\u0e2d\u0e34\u0e07 2026092420010099\n", {"amount": 500, "date": "2026-09-24", "receiver": "นางสาว มินตรา สวยงาม"}],
    "qr": ["22 \u0e01.\u0e38\u0e22. 69 08:10 \u0e19.\n\n\u0e19\u0e32\u0e22 \u0e2a\u0e21\u0e0a\u0e32\u0e22 \u0e43\u0e08\u0e15\u0e14\u0e35\n\n\u0e18.\u0e01\u0e2a\u0e34\u0e01\u0e23\u0e44\u0e17\u0e22\n\n7-6\u0e40\u0e0a\u0e31\u0e0a\u0e39\u0e1f \u0e2a\u0e32\u0e02\u0e32 12345\n\u0e23\u0e2b\u0e31\u0e2a\u0e23\u0e49\u0e32\u0e19\u0e04\u0e49\u0e32 010555123\n\n\u0e08\u0e4d\u0e32\u0e19\u0e27\u0e19:\n\n89.00 \u0e1a\u0e32\u0e17\n", {"amount": 89, "date": "2026-09-22", "receiver": undefined}],
    };
    for (const [name, [text, expected]] of Object.entries(cases)) expect(parseSlip(text, TODAY), name).toMatchObject(expected);
  });
});
