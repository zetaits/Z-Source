import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { resolveProviders } from "@/services/providers/factory";
import type { QuotaTracker } from "@/services/http/quotaTracker";
import type { QuotaSnapshot } from "@/services/providers/OddsProvider";

interface NavItemDef { to: string; label: string; shortcut: string; end: boolean }
interface Group { section: string; items: readonly NavItemDef[] }

const GROUPS: readonly Group[] = [
  {
    section: "WORK",
    items: [
      { to: "/",        label: "COMMAND",    shortcut: "1", end: true },
      { to: "/scanner", label: "SCANNER",    shortcut: "2", end: false },
    ],
  },
  {
    section: "PERFORMANCE",
    items: [
      { to: "/bankroll", label: "BANKROLL", shortcut: "3", end: false },
      { to: "/metrics",  label: "METRICS",  shortcut: "4", end: false },
      { to: "/strategy", label: "STRATEGY", shortcut: "5", end: false },
    ],
  },
  {
    section: "CFG",
    items: [
      { to: "/settings", label: "SETTINGS", shortcut: "6", end: false },
    ],
  },
];

export function Sidebar() {
  return (
    <aside
      style={{
        width: 220,
        flex: "0 0 220px",
        height: "100%",
        background: "var(--zs-bg)",
        borderRight: "1px solid var(--zs-border)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <LogoBlock />
      <nav style={{ flex: 1, padding: "14px 0", overflow: "auto" }} className="zs-scroll">
        {GROUPS.map((g) => (
          <NavGroup key={g.section} group={g} />
        ))}
      </nav>
      <ProviderStrip />
    </aside>
  );
}

function LogoBlock() {
  return (
    <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--zs-border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: "var(--zs-accent)",
            color: "var(--zs-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "-0.04em",
          }}
        >
          Z
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: "-0.01em",
            lineHeight: 1,
            color: "var(--zs-fg)",
          }}
        >
          Z—SOURCE
        </div>
      </div>
    </div>
  );
}

function NavGroup({ group }: { group: Group }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--zs-fg-muted)",
          letterSpacing: "0.20em",
          padding: "0 18px 8px",
        }}
      >
        ── {group.section} ──
      </div>
      {group.items.map((item) => (
        <NavItem key={item.to} item={item} />
      ))}
    </div>
  );
}

function NavItem({ item }: { item: NavItemDef }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `zs-nav-item${isActive ? " active" : ""}`}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        padding: "8px 18px",
        paddingLeft: 20,
        background: isActive ? "var(--zs-accent-fill)" : "transparent",
        color: isActive ? "var(--zs-accent)" : "var(--zs-fg-dim)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: isActive ? 700 : 500,
        letterSpacing: "0.08em",
        textAlign: "left",
        textDecoration: "none",
      })}
    >
      {({ isActive }) => (
        <>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="zs-nav-chev"
              style={{ color: isActive ? "var(--zs-accent)" : "var(--zs-fg-faint)" }}
            >
              ▸
            </span>
            {item.label}
          </span>
          <span style={{ fontSize: 9, color: "var(--zs-fg-faint)", fontFamily: "var(--font-mono)" }}>
            {item.shortcut}
          </span>
        </>
      )}
    </NavLink>
  );
}

function ProviderStrip() {
  const { data: settings } = useSettings();
  const trackers = useMemo<QuotaTracker[]>(
    () => (settings ? resolveProviders(settings).quotaTrackers : []),
    [settings],
  );

  return (
    <div style={{ borderTop: "1px solid var(--zs-border)", padding: "12px 18px" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--zs-fg-muted)",
          letterSpacing: "0.18em",
          marginBottom: 8,
        }}
      >
        ── FEEDS ──
      </div>
      {trackers.length === 0 ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--zs-fg-muted)",
            letterSpacing: "0.10em",
          }}
        >
          v0.1.0 · scaffold
        </div>
      ) : (
        trackers.slice(0, 4).map((t) => <ProviderRow key={t.providerId} tracker={t} />)
      )}
    </div>
  );
}

function ProviderRow({ tracker }: { tracker: QuotaTracker }) {
  const [snap, setSnap] = useState<QuotaSnapshot>(() => tracker.snapshot());
  useEffect(() => tracker.subscribe(setSnap), [tracker]);

  const display = useMemo(() => {
    const rem = snap.remaining;
    const cap = tracker.capacity;
    if (rem === null || cap === null) return "—";
    return `${rem}/${cap}`;
  }, [snap, tracker]);

  const tone = useMemo(() => {
    const rem = snap.remaining;
    const cap = tracker.capacity;
    if (rem === null || cap === null) return "var(--zs-fg-muted)";
    const ratio = rem / cap;
    return ratio <= 0.1 ? "var(--zs-neg)" : ratio <= 0.25 ? "var(--zs-accent)" : "var(--zs-pos)";
  }, [snap, tracker]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        marginBottom: 4,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--zs-fg-dim)", minWidth: 0 }}>
        <span
          style={{ width: 5, height: 5, background: tone, flexShrink: 0 }}
          aria-hidden
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {tracker.label}
        </span>
      </span>
      <span style={{ color: "var(--zs-fg)" }}>{display}</span>
    </div>
  );
}
