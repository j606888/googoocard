import { describe, expect, it } from "vitest";
import { describeAttendanceSubmitError } from "./attendanceSubmitError";

describe("describeAttendanceSubmitError", () => {
  it("flags a period someone else already finalized", () => {
    const r = describeAttendanceSubmitError({ status: 409, data: { error: "attendance_already_taken" } });
    expect(r.alreadyTaken).toBe(true);
    expect(r.message).toContain("已經有人點過名");
  });

  it("explains a card exhausted mid-request", () => {
    const r = describeAttendanceSubmitError({ status: 409, data: { error: "card_exhausted" } });
    expect(r).toEqual({ alreadyTaken: false, message: expect.stringContaining("課卡") });
  });

  it("distinguishes network failures from server errors", () => {
    expect(describeAttendanceSubmitError({ status: "FETCH_ERROR" }).message).toContain("網路");
    expect(describeAttendanceSubmitError({ status: 500, data: { error: "Internal server error" } }).message).toContain("伺服器");
    expect(describeAttendanceSubmitError(undefined).alreadyTaken).toBe(false);
  });
});
