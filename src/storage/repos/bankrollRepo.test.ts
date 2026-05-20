import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BetId } from "@/domain/ids";
import { __setStorageForTests } from "@/storage";
import { InMemoryAdapter } from "@/test/helpers/InMemoryAdapter";
import { bankrollRepo } from "./bankrollRepo";

describe("bankrollRepo", () => {
  let db: InMemoryAdapter;

  beforeEach(() => {
    db = new InMemoryAdapter();
    __setStorageForTests(db);
  });

  afterEach(() => {
    __setStorageForTests(null);
  });

  it("returns default settings when none persisted", async () => {
    const s = await bankrollRepo.loadSettings();
    expect(s.currency).toBe("USD");
    expect(s.startingBankrollMinor).toBe(100_000);
  });

  it("round-trips settings", async () => {
    await bankrollRepo.saveSettings({
      currency: "EUR",
      unitValueMinor: 5_000,
      startingBankrollMinor: 250_000,
    });
    const s = await bankrollRepo.loadSettings();
    expect(s).toEqual({ currency: "EUR", unitValueMinor: 5_000, startingBankrollMinor: 250_000 });
  });

  it("uses starting bankroll when ledger is empty", async () => {
    const bal = await bankrollRepo.currentBalanceMinor();
    expect(bal).toBe(100_000);
  });

  it("tracks running balance across appends", async () => {
    await bankrollRepo.append({ kind: "DEPOSIT", amountMinor: 50_000 });
    await bankrollRepo.append({ kind: "BET_STAKE", amountMinor: -10_000 });
    await bankrollRepo.append({ kind: "BET_RESULT", amountMinor: 22_000 });

    const bal = await bankrollRepo.currentBalanceMinor();
    expect(bal).toBe(100_000 + 50_000 - 10_000 + 22_000);

    const ledger = await bankrollRepo.listLedger();
    expect(ledger).toHaveLength(3);
    // listLedger returns newest-first
    expect(ledger[0]?.kind).toBe("BET_RESULT");
    expect(ledger[2]?.kind).toBe("DEPOSIT");
  });

  it("computes open exposure from OPEN bets only", async () => {
    db.seedBet({ id: "b1", status: "OPEN", stake_minor: 7_000 });
    db.seedBet({ id: "b2", status: "OPEN", stake_minor: 3_000 });
    db.seedBet({ id: "b3", status: "SETTLED", stake_minor: 99_000 });

    const exposure = await bankrollRepo.openExposureMinor();
    expect(exposure).toBe(10_000);
  });

  it("appends with provided betId and occurredAt", async () => {
    const occurredAt = "2026-04-14T10:00:00.000Z";
    const entry = await bankrollRepo.append({
      kind: "BET_STAKE",
      amountMinor: -5_000,
      betId: BetId("bet-xyz"),
      occurredAt,
      note: "demo",
    });
    expect(entry.betId).toBe("bet-xyz");
    expect(entry.occurredAt).toBe(occurredAt);
    expect(entry.note).toBe("demo");
    expect(entry.balanceAfterMinor).toBe(95_000);
  });
});
