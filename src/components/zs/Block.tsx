import type { CSSProperties, ReactNode } from "react";

interface Props {
  head?: ReactNode;
  headRight?: ReactNode;
  children: ReactNode;
  pad?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Block({ head, headRight, children, pad = true, className = "", style }: Props) {
  return (
    <div className={`zs-block ${className}`} style={style}>
      {head !== undefined && (
        <div className="zs-block-head">
          <div className="l">{head}</div>
          {headRight !== undefined && <div className="r">{headRight}</div>}
        </div>
      )}
      <div className="zs-block-body" style={pad ? undefined : { padding: 0 }}>
        {children}
      </div>
    </div>
  );
}
