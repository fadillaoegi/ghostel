import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, lookSchema, normalizeName, parseProfileInput, randomLook, validateName } from "../src/index";

describe("normalizeName", () => {
  it("trims, collapses whitespace and applies NFC", () => {
    expect(normalizeName("  Count \t  Dracula \n")).toBe("Count Dracula");
    expect(normalizeName("Jose\u0301")).toBe("Jos\u00e9");
  });
});

describe("validateName", () => {
  it.each(["Bo", "Count Dracula", "ghost_42", "O'Lantern", "Mr. Bones", "Hantu-Kecil", "Zoë", "幽霊さん", "Ánh"])(
    "accepts %s",
    (name) => {
      expect(validateName(name)).toEqual({ ok: true, value: normalizeName(name) });
    },
  );

  it("counts characters, not UTF-16 units", () => {
    expect(validateName("👻".repeat(1)).ok).toBe(false); // emoji is not a letter
    expect(validateName("幽".repeat(20)).ok).toBe(true);
    expect(validateName("幽".repeat(21)).ok).toBe(false);
  });

  it("rejects too short names with a clear message", () => {
    expect(validateName(" a ")).toEqual({ ok: false, message: "Name must be at least 2 characters." });
  });

  it("rejects too long names with a clear message", () => {
    expect(validateName("a".repeat(21))).toEqual({ ok: false, message: "Name can be at most 20 characters." });
    expect(validateName("a".repeat(5000)).ok).toBe(false);
  });

  it("rejects empty and non-string input", () => {
    for (const value of ["", "    ", undefined, null, 42, {}, ["Bo"]]) {
      expect(validateName(value)).toEqual({ ok: false, message: "Please enter a name." });
    }
  });

  it.each(["<script>", "-dash first", "__", "Bo\u200b", "Bo\u0000", "a/b", "{{x}}", "👻 Ghost"])("rejects %j", (name) => {
    const result = validateName(name);
    expect(result.ok).toBe(false);
  });
});

describe("look", () => {
  it("accepts the default look", () => {
    expect(lookSchema.parse(DEFAULT_LOOK)).toEqual(DEFAULT_LOOK);
  });

  it("rejects unknown values and extra keys", () => {
    expect(lookSchema.safeParse({ ...DEFAULT_LOOK, head: "dragon" }).success).toBe(false);
    expect(lookSchema.safeParse({ ...DEFAULT_LOOK, body: "#ff0000" }).success).toBe(false);
    expect(lookSchema.safeParse({ ...DEFAULT_LOOK, extra: 1 }).success).toBe(false);
    expect(lookSchema.safeParse({ body: "violet" }).success).toBe(false);
  });

  it("randomLook always produces a valid look", () => {
    let seed = 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 200; i++) expect(lookSchema.safeParse(randomLook(rng)).success).toBe(true);
    expect(lookSchema.safeParse(randomLook(() => 0.9999999)).success).toBe(true);
  });
});

describe("parseProfileInput", () => {
  it("returns normalised profile", () => {
    expect(parseProfileInput({ name: "  Mr   Bones ", look: DEFAULT_LOOK })).toEqual({
      ok: true,
      value: { name: "Mr Bones", look: DEFAULT_LOOK },
    });
  });

  it("names the failing field", () => {
    expect(parseProfileInput({ name: "x", look: DEFAULT_LOOK })).toMatchObject({ ok: false, field: "name" });
    expect(parseProfileInput({ name: "Bo", look: { ...DEFAULT_LOOK, hat: "tiara" } })).toMatchObject({
      ok: false,
      field: "look",
    });
    expect(parseProfileInput(null)).toMatchObject({ ok: false, field: "body" });
    expect(parseProfileInput([])).toMatchObject({ ok: false, field: "body" });
  });
});
