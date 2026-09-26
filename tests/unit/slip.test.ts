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
});
