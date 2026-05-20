import type { CSSProperties, ReactNode } from "react";

interface Props {
  head?: ReactNode;
  headRight?: ReactNode;
  children: ReactNode;
  pad?: boolean;
  className?: string;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}

export function Block({ head, headRight, children, pad = true, className = "", style, bodyStyle }: Props) {
  const body: CSSProperties = { ...(pad ? {} : { padding: 0 }), ...(bodyStyle ?? {}) };
  return (
    <div className={`zs-block ${className}`} style={style}>
      {head !== undefined && (
        <div className="zs-block-head">
          <div className="l">{head}</div>
          {headRight !== undefined && <div className="r">{headRight}</div>}
        </div>
      )}
      <div className="zs-block-body" style={body}>
        {children}
      </div>
    </div>
  );
}
