import { useNavigate } from "react-router-dom";
import { SPORTS } from "@/config/sports";
import { SPORT_ICONS } from "@/config/sportIcons";
import { useSport } from "@/features/sport/SportContext";

// ============================================================================
// SPORT RAIL — thin vertical workspace switcher, flush-left, BEFORE the nav
// sidebar (Bloomberg-terminal pattern). Switching sport is a workspace switch,
// not a filter: it re-keys the whole content context. Driven entirely by the
// SPORTS registry — append one object there and a tile appears here.
// ============================================================================

const RAIL_WIDTH = 70;

export function SportRail() {
  const { activeSportId, setSport } = useSport();
  const navigate = useNavigate();

  return (
    <aside
      style={{
        width: RAIL_WIDTH,
        flex: `0 0 ${RAIL_WIDTH}px`,
        height: "100%",
        background: "var(--zs-bg)",
        borderRight: "1px solid var(--zs-border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* brand mark — matches the 46px topbar height */}
      <div
        style={{
          height: 46,
          width: "100%",
          borderBottom: "1px solid var(--zs-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            background: "var(--zs-accent)",
            color: "var(--zs-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: "-0.04em",
          }}
        >
          Z
        </div>
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          color: "var(--zs-fg-muted)",
          letterSpacing: "0.18em",
          padding: "12px 0 6px",
        }}
      >
        SPORT
      </div>

      <div
        className="zs-scroll"
        style={{
          flex: 1,
          width: "100%",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          paddingBottom: 8,
        }}
      >
        {SPORTS.map((s) => {
          const active = s.id === activeSportId;
          const disabled = !s.enabled;
          const icon = SPORT_ICONS[s.id];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => !disabled && setSport(s.id)}
              disabled={disabled}
              title={disabled ? `${s.label} — coming soon` : s.label}
              className="zs-rail-item"
              data-active={active ? "1" : undefined}
              style={{
                position: "relative",
                width: 58,
                padding: "8px 0 6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                background: "transparent",
                border: "none",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.34 : 1,
              }}
            >
              {/* active spine */}
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  background: active ? "var(--zs-accent)" : "transparent",
                  transition: "background 120ms var(--ease-snap)",
                }}
              />
              <span
                className="zs-rail-tile"
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: "0.02em",
                  border: "1px solid",
                  borderColor: active ? "var(--zs-accent)" : "var(--zs-border-bright)",
                  background: active ? "var(--zs-accent)" : "var(--zs-surface)",
                  color: active ? "var(--zs-bg)" : "var(--zs-fg-dim)",
                  transition:
                    "color 120ms var(--ease-snap), background 120ms var(--ease-snap), border-color 120ms var(--ease-snap)",
                }}
              >
                {icon ?? s.mono}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: "0.08em",
                  color: active ? "var(--zs-accent)" : "var(--zs-fg-muted)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  transition: "color 120ms var(--ease-snap)",
                }}
              >
                {s.code}
              </span>
              {/* live dot */}
              {s.live && s.enabled && (
                <span
                  className={active ? "zs-pulse" : ""}
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 9,
                    right: 9,
                    width: 5,
                    height: 5,
                    background: active ? "var(--zs-bg)" : "var(--zs-pos)",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* add sport — routes to sport onboarding/config (settings for now) */}
      <button
        type="button"
        className="zs-rail-add"
        title="Add sport"
        aria-label="Add sport"
        onClick={() => navigate("/settings")}
        style={{
          width: "100%",
          padding: "12px 0",
          borderTop: "1px solid var(--zs-border)",
          background: "transparent",
          color: "var(--zs-fg-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: 18,
          cursor: "pointer",
        }}
      >
        +
      </button>
    </aside>
  );
}
