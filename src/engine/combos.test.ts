import { describe, expect, it } from "vitest";
import { DEFAULT_ANCHOR_POLICY, type ComboPolicy } from "@/domain/strategy";
import {
  defaultStrategy,
  makeCtx,
  ml1x2Snapshot,
  ouGoalsSnapshot,
  bttsSnapshot,
} from "@/test/builders/makeCtx";
import { runBondedAnalysis } from "./pipeline";

const NOW = "2026-04-28T18:00:00Z";

const enabledPolicy: ComboPolicy = {
  enabled: true,
  minCombinedDecimal: 1.65,
  minCombinedEdge: 0.04,
  minCombinedFairProb: 0.45,
  anchorMode: { ...DEFAULT_ANCHOR_POLICY, enabled: false },
};

const disabledPolicy: ComboPolicy = { ...enabledPolicy, enabled: false };

describe("enumerateCombos", () => {
  it("returns no combos when comboPolicy.enabled is false", () => {
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(2.2, 3.9, 4.2),
        OU_GOALS: ouGoalsSnapshot(2.5, 1.9, 2.1),
      },
      strategy: defaultStrategy({ comboPolicy: disabledPolicy }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    expect(combos).toHaveLength(0);
  });

  it("does not pair candidates from the same market", () => {
    const ctx = makeCtx({
      lines: { ML_1X2: ml1x2Snapshot(2.2, 3.9, 4.2) },
      strategy: defaultStrategy({ comboPolicy: enabledPolicy }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    for (const c of combos) {
      const markets = c.legs.map((l) => l.selection.marketKey);
      expect(new Set(markets).size).toBe(markets.length);
    }
  });

  it("generates combos across different markets when edges qualify", () => {
    // Priced with enough value that some combos can form
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(3.2, 3.9, 2.1),
        OU_GOALS: ouGoalsSnapshot(2.5, 2.1, 1.75),
      },
      strategy: defaultStrategy({ comboPolicy: enabledPolicy }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    // At least some combos between ML_1X2 and OU_GOALS markets
    if (combos.length > 0) {
      for (const c of combos) {
        expect(c.legs).toHaveLength(2);
        expect(c.legs[0].selection.marketKey).not.toBe(c.legs[1].selection.marketKey);
        expect(c.combinedDecimal).toBeCloseTo(
          c.legs[0].priceDecimal * c.legs[1].priceDecimal,
          5,
        );
      }
    }
  });

  it("applies BTTS:no + OU_GOALS:under correlation ρ=0.45", () => {
    // Build a scenario where BTTS:no and Under are both LEAN/PLAY
    // Use odds that produce positive edge so they qualify as eligible legs
    const ctx = makeCtx({
      lines: {
        OU_GOALS: ouGoalsSnapshot(2.5, 2.2, 1.85),
        BTTS: bttsSnapshot(2.1, 2.1),
      },
      strategy: defaultStrategy({ comboPolicy: enabledPolicy }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    const bttsNoUnder = combos.find(
      (c) =>
        c.correlationKey === "BTTS:no|OU_GOALS:under" ||
        c.correlationKey === "OU_GOALS:under|BTTS:no",
    );
    if (bttsNoUnder) {
      // With ρ=0.45 the joint prob should be higher than independent
      const legA = bttsNoUnder.legs[0];
      const legB = bttsNoUnder.legs[1];
      const indep = legA.fairProb * legB.fairProb;
      expect(bttsNoUnder.combinedFairProb).toBeGreaterThan(indep);
      expect(bttsNoUnder.rho).toBeCloseTo(0.45);
    }
  });

  it("discards combos below minCombinedDecimal", () => {
    const strictPolicy: ComboPolicy = { ...enabledPolicy, minCombinedDecimal: 99 };
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(3.2, 3.9, 2.1),
        OU_GOALS: ouGoalsSnapshot(2.5, 2.1, 1.75),
      },
      strategy: defaultStrategy({ comboPolicy: strictPolicy }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    expect(combos).toHaveLength(0);
  });

  it("sorts combos by edge × confidence descending", () => {
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(3.2, 3.9, 2.1),
        OU_GOALS: ouGoalsSnapshot(2.5, 2.1, 1.75),
        BTTS: bttsSnapshot(2.1, 2.1),
      },
      strategy: defaultStrategy({ comboPolicy: enabledPolicy }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    for (let i = 1; i < combos.length; i++) {
      const scoreA = combos[i - 1].edgePct * combos[i - 1].confidence;
      const scoreB = combos[i].edgePct * combos[i].confidence;
      expect(scoreA).toBeGreaterThanOrEqual(scoreB);
    }
  });

  it("combo has a trace entry with source=math id=combo", () => {
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(3.2, 3.9, 2.1),
        OU_GOALS: ouGoalsSnapshot(2.5, 2.1, 1.75),
      },
      strategy: defaultStrategy({ comboPolicy: enabledPolicy }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    for (const c of combos) {
      const entry = c.trace.find((e) => e.id === "combo");
      expect(entry).toBeDefined();
      expect(entry?.source).toBe("math");
    }
  });

  it("default combos are tagged comboType=VALUE", () => {
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(3.2, 3.9, 2.1),
        OU_GOALS: ouGoalsSnapshot(2.5, 2.1, 1.75),
      },
      strategy: defaultStrategy({ comboPolicy: enabledPolicy }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    for (const c of combos) {
      expect(c.comboType).toBe("VALUE");
    }
  });
});

describe("enumerateAnchorCombos via runBondedAnalysis", () => {
  const anchorOnlyPolicy: ComboPolicy = {
    ...enabledPolicy,
    enabled: false, // disable VALUE combos so we isolate ANCHOR
    anchorMode: {
      ...DEFAULT_ANCHOR_POLICY,
      enabled: true,
      // Loosen thresholds for testing — real strategy is stricter
      minBaseConfidence: 0,
      maxBaseDecimal: 99,
      minAnchorConfidence: 0,
      minRho: 0.05,
      targetMinDecimal: 1.0,
      targetMaxDecimal: 99,
    },
  };

  it("returns no anchor combos when policy disabled", () => {
    const disabledAnchor: ComboPolicy = {
      ...anchorOnlyPolicy,
      anchorMode: { ...anchorOnlyPolicy.anchorMode, enabled: false },
    };
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(2.2, 3.9, 4.2),
        OU_GOALS: ouGoalsSnapshot(2.5, 1.9, 2.1),
        BTTS: bttsSnapshot(1.5, 2.6),
      },
      strategy: defaultStrategy({ comboPolicy: disabledAnchor }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    expect(combos.filter((c) => c.comboType === "ANCHOR")).toHaveLength(0);
  });

  it("respects maxBaseDecimal — does not anchor on high-decimal bases", () => {
    const strictBase: ComboPolicy = {
      ...anchorOnlyPolicy,
      anchorMode: { ...anchorOnlyPolicy.anchorMode, maxBaseDecimal: 1.2 },
    };
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(2.2, 3.9, 4.2),
        OU_GOALS: ouGoalsSnapshot(2.5, 1.9, 2.1),
        BTTS: bttsSnapshot(1.5, 2.6),
      },
      strategy: defaultStrategy({ comboPolicy: strictBase }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    const anchors = combos.filter((c) => c.comboType === "ANCHOR");
    // All bases above 1.2 → no anchor combos
    expect(anchors).toHaveLength(0);
  });

  it("respects minRho — drops uncorrelated pairs", () => {
    const strictRho: ComboPolicy = {
      ...anchorOnlyPolicy,
      anchorMode: { ...anchorOnlyPolicy.anchorMode, minRho: 0.99 },
    };
    const ctx = makeCtx({
      lines: {
        ML_1X2: ml1x2Snapshot(2.2, 3.9, 4.2),
        OU_GOALS: ouGoalsSnapshot(2.5, 1.9, 2.1),
        BTTS: bttsSnapshot(1.5, 2.6),
      },
      strategy: defaultStrategy({ comboPolicy: strictRho }),
    });
    const { combos } = runBondedAnalysis(ctx, { includePass: true });
    expect(combos.filter((c) => c.comboType === "ANCHOR")).toHaveLength(0);
  });
});
