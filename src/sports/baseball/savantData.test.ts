import { describe, expect, it } from "vitest";
import { _parseCsv, _parseSavantCsv } from "./savantData";

// ---------------------------------------------------------------------------
// _parseCsv — quote-aware CSV parser
// ---------------------------------------------------------------------------
describe("_parseCsv", () => {
  it("parses simple CSV with headers", () => {
    const text = "name,age,team\nSkubal,28,Tigers\nKershaw,38,Dodgers";
    const rows = _parseCsv(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: "Skubal", age: "28", team: "Tigers" });
    expect(rows[1]).toEqual({ name: "Kershaw", age: "38", team: "Dodgers" });
  });

  it("handles quoted fields containing commas", () => {
    const text = '"last_name, first_name",player_id,era\n"Skubal, Tarik",669373,2.21\n"Kershaw, Clayton",543037,3.50';
    const rows = _parseCsv(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]["last_name, first_name"]).toBe("Skubal, Tarik");
    expect(rows[0]["player_id"]).toBe("669373");
    expect(rows[0]["era"]).toBe("2.21");
  });

  it("returns empty array for empty text", () => {
    expect(_parseCsv("")).toEqual([]);
  });

  it("returns empty array for header-only text", () => {
    expect(_parseCsv("name,age")).toEqual([]);
  });

  it("handles Windows-style line endings (\\r\\n)", () => {
    const text = "a,b\r\n1,2\r\n3,4";
    const rows = _parseCsv(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("trims whitespace from cells", () => {
    const text = "x , y\n  hello , world  ";
    const rows = _parseCsv(text);
    expect(rows[0]["x"]).toBe("hello");
    expect(rows[0]["y"]).toBe("world");
  });

  it("handles trailing newline gracefully", () => {
    const text = "a,b\n1,2\n";
    const rows = _parseCsv(text);
    expect(rows).toHaveLength(1);
  });

  it("handles rows with fewer cells than headers", () => {
    const text = "a,b,c\n1,2";
    const rows = _parseCsv(text);
    expect(rows[0]["c"]).toBe("");
  });
});

// ---------------------------------------------------------------------------
// _parseSavantCsv — discipline leaderboard with percent conversion
// ---------------------------------------------------------------------------
describe("_parseSavantCsv", () => {
  const savantCsv = [
    '"last_name, first_name","player_id","year","k_percent","whiff_percent","csw_percent","o_swing_percent","z_swing_percent"',
    '"Skubal, Tarik",669373,2025,28.5,30.2,33.1,29.5,70.0',
    '"Kershaw, Clayton",543037,2025,19.8,16.9,,28.0,68.5',
  ].join("\n");

  it("parses player_id correctly", () => {
    const rows = _parseSavantCsv(savantCsv);
    expect(rows).toHaveLength(2);
    expect(rows[0].playerId).toBe(669373);
    expect(rows[1].playerId).toBe(543037);
  });

  it("converts percent columns to 0..1 (e.g. 28.5 -> 0.285)", () => {
    const rows = _parseSavantCsv(savantCsv);
    expect(rows[0].kPct).toBeCloseTo(0.285, 5);
    expect(rows[0].whiffPct).toBeCloseTo(0.302, 5);
    expect(rows[0].cswPct).toBeCloseTo(0.331, 5);
    expect(rows[0].oSwingPct).toBeCloseTo(0.295, 5);
    expect(rows[0].zSwingPct).toBeCloseTo(0.700, 5);
  });

  it("returns undefined for empty csw_percent cells", () => {
    const rows = _parseSavantCsv(savantCsv);
    expect(rows[1].cswPct).toBeUndefined();
  });

  it("returns undefined for empty o_swing_percent", () => {
    // Kershaw has o_swing_percent = "28.0", so let's make a row with empty
    const csvWithEmpty = [
      '"last_name, first_name","player_id","k_percent","whiff_percent","csw_percent","o_swing_percent","z_swing_percent"',
      '"Test, Player",999999,20.0,15.0,,,65.0',
    ].join("\n");
    const rows = _parseSavantCsv(csvWithEmpty);
    expect(rows[0].oSwingPct).toBeUndefined();
    expect(rows[0].cswPct).toBeUndefined();
    expect(rows[0].zSwingPct).toBeCloseTo(0.65, 5);
  });

  it("drops rows without player_id", () => {
    const csvNoId = [
      '"last_name, first_name","player_id","k_percent"',
      '"No ID, Player",,25.0',
      '"Has ID, Player",123456,20.0',
    ].join("\n");
    const rows = _parseSavantCsv(csvNoId);
    expect(rows).toHaveLength(1);
    expect(rows[0].playerId).toBe(123456);
  });

  it("returns empty array for empty CSV text", () => {
    expect(_parseSavantCsv("")).toEqual([]);
  });

  it("returns empty array for header-only CSV", () => {
    const header = '"last_name, first_name","player_id","k_percent"';
    expect(_parseSavantCsv(header)).toEqual([]);
  });

  it("handles non-numeric percent values as undefined", () => {
    const csvBad = [
      '"last_name, first_name","player_id","k_percent","whiff_percent"',
      '"Bad, Data",111111,abc,25.0',
    ].join("\n");
    const rows = _parseSavantCsv(csvBad);
    expect(rows[0].kPct).toBeUndefined();
    expect(rows[0].whiffPct).toBeCloseTo(0.25, 5);
  });

  it("handles real-world Savant CSV format with quoted name containing comma", () => {
    // Real shape from Baseball Savant
    const realCsv = [
      '"last_name, first_name","player_id","year","k_percent","whiff_percent","csw_percent","o_swing_percent","z_swing_percent"',
      '"Corbin, Patrick",571578,2025,19.8,26.9,,29.5,84.2',
      '"Schwellenbach, Spencer",680885,2025,24.9,28.3,,34.1,80.5',
    ].join("\n");
    const rows = _parseSavantCsv(realCsv);
    expect(rows).toHaveLength(2);
    expect(rows[0].playerId).toBe(571578);
    expect(rows[0].kPct).toBeCloseTo(0.198, 5);
    expect(rows[0].cswPct).toBeUndefined(); // empty cell
    expect(rows[1].playerId).toBe(680885);
    expect(rows[1].oSwingPct).toBeCloseTo(0.341, 5);
  });

  it("handles CSV with columns in different order", () => {
    // Columns reordered — parser should read by header name, not position
    const reordered = [
      '"player_id","whiff_percent","last_name, first_name","k_percent"',
      '669373,30.2,"Skubal, Tarik",28.5',
    ].join("\n");
    const rows = _parseSavantCsv(reordered);
    expect(rows).toHaveLength(1);
    expect(rows[0].playerId).toBe(669373);
    expect(rows[0].kPct).toBeCloseTo(0.285, 5);
    expect(rows[0].whiffPct).toBeCloseTo(0.302, 5);
  });

  it("handles missing columns gracefully (undefined, not NaN)", () => {
    // CSV has no csw_percent, o_swing_percent, z_swing_percent columns at all
    const minimalCsv = [
      '"player_id","k_percent","whiff_percent"',
      "669373,28.5,30.2",
    ].join("\n");
    const rows = _parseSavantCsv(minimalCsv);
    expect(rows[0].cswPct).toBeUndefined();
    expect(rows[0].oSwingPct).toBeUndefined();
    expect(rows[0].zSwingPct).toBeUndefined();
  });
});
