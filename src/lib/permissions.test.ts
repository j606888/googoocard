import { describe, expect, it } from "vitest";
import {
  PERMISSION_KEYS,
  effectivePermissions,
  overridesFor,
  visiblePermissions,
} from "./permissions";

const ALL_MODULES = ["curriculum", "finance"];
const sorted = (set: Set<string>) => [...set].sort();

describe("effectivePermissions — 角色預設組合", () => {
  it("owner／admin 有全部權限", () => {
    for (const role of ["owner", "admin"]) {
      expect(sorted(effectivePermissions({ role, modules: ALL_MODULES }))).toEqual([...PERMISSION_KEYS].sort());
    }
  });

  it("老師：看＋編輯技能樹；小幫手：只能看技能樹", () => {
    expect(sorted(effectivePermissions({ role: "teacher", modules: ALL_MODULES }))).toEqual([
      "curriculum.edit",
      "curriculum.view",
    ]);
    expect(sorted(effectivePermissions({ role: "assistant", modules: ALL_MODULES }))).toEqual([
      "curriculum.view",
    ]);
  });

  it("不認得的角色當成小幫手", () => {
    expect(sorted(effectivePermissions({ role: "ghost", modules: ALL_MODULES }))).toEqual(["curriculum.view"]);
  });
});

describe("effectivePermissions — 個人加減", () => {
  it("grants 加上、revokes 拿掉", () => {
    const result = effectivePermissions({
      role: "teacher",
      grants: ["finance.view"],
      revokes: ["curriculum.edit"],
      modules: ALL_MODULES,
    });
    expect(sorted(result)).toEqual(["curriculum.view", "finance.view"]);
  });

  it("owner 的權限拿不掉，也不需要加", () => {
    const result = effectivePermissions({ role: "owner", revokes: ["members.manage"], modules: ALL_MODULES });
    expect(result.has("members.manage")).toBe(true);
  });

  it("不認得的字串直接忽略", () => {
    const result = effectivePermissions({ role: "assistant", grants: ["root.everything"], modules: ALL_MODULES });
    expect(sorted(result)).toEqual(["curriculum.view"]);
  });
});

describe("effectivePermissions — 模組沒開", () => {
  it("模組的權限跟著消失，核心權限不受影響", () => {
    const result = effectivePermissions({ role: "admin", modules: ["curriculum"] });
    expect(sorted(result)).toEqual(["curriculum.edit", "curriculum.view", "members.manage", "modules.manage"]);
  });

  it("沒開任何模組時，個人多給的模組權限也不算", () => {
    const result = effectivePermissions({ role: "teacher", grants: ["finance.view"], modules: [] });
    expect(result.size).toBe(0);
  });
});

describe("overridesFor", () => {
  const visible = visiblePermissions(ALL_MODULES);

  it("跟角色預設一樣 → 不存任何差異", () => {
    expect(overridesFor("teacher", ["curriculum.view", "curriculum.edit"], visible)).toEqual({
      grants: [],
      revokes: [],
    });
  });

  it("多勾的存成 grants、取消的存成 revokes", () => {
    expect(overridesFor("teacher", ["curriculum.view", "finance.view"], visible)).toEqual({
      grants: ["finance.view"],
      revokes: ["curriculum.edit"],
    });
  });

  it("畫面上沒列出的（模組沒開）保留原本的差異", () => {
    const shown = visiblePermissions(["curriculum"]);
    const result = overridesFor("teacher", ["curriculum.view", "curriculum.edit"], shown, {
      grants: ["finance.view"],
      revokes: [],
    });
    expect(result).toEqual({ grants: ["finance.view"], revokes: [] });
  });
});

describe("visiblePermissions", () => {
  it("只列出核心＋有開的模組", () => {
    expect(visiblePermissions([])).toEqual(["members.manage", "modules.manage"]);
    expect(visiblePermissions(["finance"])).toEqual([
      "members.manage",
      "modules.manage",
      "finance.view",
      "finance.edit",
    ]);
  });
});
