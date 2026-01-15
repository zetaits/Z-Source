import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export const OnboardingDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("lyratip-onboarding-seen");
    if (!hasSeenOnboarding) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("lyratip-onboarding-seen", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-primary/20 p-2 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-2xl text-foreground">Bienvenido a LyraTip</DialogTitle>
          </div>
          <DialogDescription className="text-foreground/80 space-y-4 pt-4">
            <p>
              LyraTip Command Center es tu asistente inteligente para análisis de apuestas deportivas,
              impulsado por IA avanzada.
            </p>
            <div className="bg-secondary/50 p-4 rounded-lg space-y-2 border border-border">
              <p className="font-semibold text-foreground">¿Cómo funciona?</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Introduce los detalles de tu pick: título, cuota y fundamentos</li>
                <li>Selecciona tu perfil de riesgo y tipo de mercado</li>
                <li>Haz clic en "Valorar Pick" para obtener un análisis profesional</li>
                <li>Recibe recomendaciones de stake, oportunidades EV+, señales y plan de acción</li>
              </ol>
            </div>
            <p className="text-sm text-muted-foreground">
              El análisis utiliza Google Gemini para ofrecerte insights detallados basados en tu información.
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end mt-4">
          <Button onClick={handleClose} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Entendido, ¡Empecemos!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
