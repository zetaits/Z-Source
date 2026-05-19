import type { ReactNode } from "react";

export type TagTone = "default" | "pos" | "neg" | "amber" | "sharp" | "info";

interface Props {
  children: ReactNode;
  tone?: TagTone;
  solid?: boolean;
  className?: string;
}

export function Tag({ children, tone = "default", solid = false, className = "" }: Props) {
  const cls = ["zs-tag"];
  if (tone === "pos") cls.push("pos");
  else if (tone === "neg") cls.push("neg");
  else if (tone === "amber") cls.push("amber");
  else if (tone === "sharp") cls.push("sharp");
  else if (tone === "info") cls.push("info");
  if (solid) cls.push("solid");
  if (className) cls.push(className);
  return <span className={cls.join(" ")}>{children}</span>;
}
