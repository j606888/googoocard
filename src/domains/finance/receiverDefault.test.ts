import { describe, it, expect } from "vitest";
import { defaultReceiverId } from "./receiverDefault";

describe("defaultReceiverId (spec §8, mirrors service/finance/receiver.ts)", () => {
  const custodianIds = [1, 7];

  it("the caller when they are a custodian", () => {
    expect(defaultReceiverId({ meId: 7, custodianIds, keeperUserId: 1 })).toBe(7);
  });

  it("the lesson branch keeper when the caller is not a custodian", () => {
    expect(defaultReceiverId({ meId: 3, custodianIds, keeperUserId: 7 })).toBe(7);
  });

  it("no default when the keeper is missing or not a custodian", () => {
    expect(defaultReceiverId({ meId: 3, custodianIds, keeperUserId: null })).toBeNull();
    expect(defaultReceiverId({ meId: 3, custodianIds, keeperUserId: 4 })).toBeNull();
    expect(defaultReceiverId({ meId: undefined, custodianIds, keeperUserId: undefined })).toBeNull();
  });
});
