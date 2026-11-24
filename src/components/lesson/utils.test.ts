import { describe, expect, it } from "vitest";
import { isVietnamese } from "./utils";

describe("isVietnamese", () => {
  it("nhận ra chữ tiếng Việt có dấu", () => {
    for (const t of ["Xin chào", "Tạm biệt", "Cảm ơn", "Chúc ngủ ngon", "đi"]) expect(isVietnamese(t)).toBe(true);
  });
  it("không chặn câu tiếng Anh", () => {
    for (const t of ["Hello", "Nice to meet you.", "How are you?", "I'm twenty"]) expect(isVietnamese(t)).toBe(false);
  });
});
