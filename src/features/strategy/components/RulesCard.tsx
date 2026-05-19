import { useEffect, useState } from "react";
import { Block, Tag } from "@/components/zs";
import type { TagTone } from "@/components/zs";
import type { Leg, RuleConfig } from "@/domain/strategy";
import { RULES } from "@/engine/rules";
import type { Rule } from "@/engine/types";

interface Props {
  rules: RuleConfig[];
  disabled?: boolean;
  onChange(row: RuleConfig): void;
}

const LEG_TONE: Record<Leg, TagTone> = {
  matchup: "amber",
  trends: "default",
  lines: "info",
  sharpVsSquare: "sharp",
  intangibles: "default",
  math: "default",
};

interface RuleRowProps {
  rule: Rule;
  config: RuleConfig;
  disabled?: boolean;
  onChange(row: RuleConfig): void;
}

const RuleRow = ({ rule, config, disabled, onChange }: RuleRowProps) => {
  const [weight, setWeight] = useState(config.weight);
  const [enabled, setEnabled] = useState(config.enabled);

  useEffect(() => {
    setWeight(config.weight);
    setEnabled(config.enabled);
  }, [config.weight, config.enabled]);

  const commitEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    onChange({ ...config, enabled: next, weight });
  };

  const commitWeight = (next: number) => {
    setWeight(next);
    onChange({ ...config, weight: next, enabled });
  };

  return (
    <tr style={!enabled ? { opacity: 0.45 } : undefined}>
      <td>
        <span
          role="switch"
          aria-checked={enabled}
          aria-label={`Enable ${rule.id}`}
          className={`zs-toggle ${enabled ? "on" : ""}`}
          onClick={disabled ? undefined : commitEnabled}
        />
      </td>
      <td>
        <div className="row-key" style={{ fontSize: 11 }}>{rule.id}</div>
        <div className="muted" style={{ fontSize: 9, marginTop: 2 }}>{rule.description}</div>
      </td>
      <td>
        <Tag tone={LEG_TONE[rule.leg]}>{rule.leg.toUpperCase()}</Tag>
      </td>
      <td className="num">
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
          <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--zs-fg)", width: 32, textAlign: "right" }}>
            {weight.toFixed(2)}
          </span>
          <input
            type="range"
            className="zs-slider"
            min={0}
            max={2}
            step={0.05}
            value={weight}
            disabled={disabled || !enabled}
            onChange={(e) => commitWeight(Number(e.target.value))}
            aria-label={`${rule.id} weight`}
            style={{ width: 100 }}
          />
        </div>
      </td>
    </tr>
  );
};

export function RulesCard({ rules, disabled, onChange }: Props) {
  const byId = new Map(rules.map((r) => [r.ruleId, r]));
  const total = RULES.length;
  const enabledCount = RULES.reduce((n, rule) => {
    const cfg = byId.get(rule.id);
    const isEnabled = cfg ? cfg.enabled : true;
    return n + (isEnabled ? 1 : 0);
  }, 0);

  return (
    <Block head={`RULES · ${enabledCount}/${total} ENABLED`} pad={false}>
      <div className="zs-scroll" style={{ maxHeight: 520, overflowY: "auto" }}>
        <table className="zs-table" style={{ tableLayout: "fixed", width: "100%" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th style={{ width: 60 }}>ON</th>
              <th>RULE</th>
              <th style={{ width: 120 }}>LEG</th>
              <th className="num" style={{ width: 200 }}>WEIGHT</th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((rule) => {
              const config: RuleConfig = byId.get(rule.id) ?? {
                ruleId: rule.id,
                enabled: true,
                weight: rule.defaultWeight,
              };
              return (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  config={config}
                  disabled={disabled}
                  onChange={onChange}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </Block>
  );
}
