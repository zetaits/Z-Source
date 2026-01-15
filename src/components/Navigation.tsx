import { NavLink } from "@/components/NavLink";
import { Activity, Sparkles, User, History } from "lucide-react";
import { cn } from "@/lib/utils";

export const Navigation = () => {
  const navItems = [
    { to: "/", label: "Analizador", icon: Activity },
    { to: "/recommendations", label: "Recomendaciones", icon: Sparkles },
    { to: "/history", label: "Historial", icon: History },
    { to: "/profile", label: "Perfil", icon: User },
  ];

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
            activeClassName="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
