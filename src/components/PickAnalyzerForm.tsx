import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, X } from "lucide-react";

interface PickAnalyzerFormProps {
  onAnalyze: (data: PickFormData) => void;
  isAnalyzing: boolean;
}

export interface BetLeg {
  market: string;
  selection: string;
  odds: string;
}

export interface PickFormData {
  homeTeam: string;
  awayTeam: string;
  offeredOdds: string;
  betType: "simple" | "parlay";
  legs: BetLeg[];
  notes: string;
}

export const PickAnalyzerForm = ({ onAnalyze, isAnalyzing }: PickAnalyzerFormProps) => {
  const [formData, setFormData] = useState<PickFormData>({
    homeTeam: "",
    awayTeam: "",
    offeredOdds: "",
    betType: "simple",
    notes: "",
    legs: [
      {
        market: "",
        selection: "",
        odds: "",
      },
    ],
  });

  const combinedOdds = useMemo(() => {
    if (formData.betType === "simple") return formData.offeredOdds || "-";
    const product = formData.legs.reduce((acc, leg) => acc * (parseFloat(leg.odds) || 1), 1);
    return Number.isFinite(product) && formData.legs.length ? product.toFixed(2) : "-";
  }, [formData.betType, formData.legs, formData.offeredOdds]);

  const combinedOddsDisplay = combinedOdds === "-" ? "-" : combinedOdds.replace(/\./g, ",");

  // Mantener la cuota ofrecida en modo parlay sincronizada con la combinada calculada
  useEffect(() => {
    if (formData.betType === "parlay" && combinedOdds !== "-" && combinedOdds !== formData.offeredOdds) {
      setFormData((prev) => ({ ...prev, offeredOdds: combinedOdds }));
    }
  }, [combinedOdds, formData.betType, formData.offeredOdds]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveOdds = formData.betType === "parlay" ? combinedOdds : formData.offeredOdds;
    onAnalyze({ ...formData, offeredOdds: effectiveOdds === "-" ? "" : effectiveOdds });
  };

  const updateLeg = (index: number, key: keyof BetLeg, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.legs];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, legs: updated };
    });
  };

  const addLeg = () => {
    setFormData((prev) => ({
      ...prev,
      legs: [...prev.legs, { market: "", selection: "", odds: "" }],
    }));
  };

  const removeLeg = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      legs: prev.legs.filter((_, i) => i !== index),
    }));
  };

  const hasValidLegs =
    formData.legs.length > 0 &&
    formData.legs.every((leg) => leg.market.trim() && leg.selection.trim() && leg.odds.trim());

  const oddsValid = formData.betType === "parlay" ? combinedOdds !== "-" : formData.offeredOdds.trim() !== "";
  const isFormValid = formData.homeTeam.trim() && formData.awayTeam.trim() && oddsValid && hasValidLegs;

  const oddsGridClass = formData.betType === "simple" ? "grid md:grid-cols-2 gap-4" : "grid md:grid-cols-2 gap-4";

  return (
    <Card className="p-6 bg-card border-border">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="homeTeam" className="text-foreground font-medium">
              Equipo local
            </Label>
            <Input
              id="homeTeam"
              placeholder="Ej: Real Madrid"
              value={formData.homeTeam}
              onChange={(e) => setFormData({ ...formData, homeTeam: e.target.value })}
              className="bg-secondary border-border text-foreground"
              disabled={isAnalyzing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="awayTeam" className="text-foreground font-medium">
              Equipo visitante
            </Label>
            <Input
              id="awayTeam"
              placeholder="Ej: Barcelona"
              value={formData.awayTeam}
              onChange={(e) => setFormData({ ...formData, awayTeam: e.target.value })}
              className="bg-secondary border-border text-foreground"
              disabled={isAnalyzing}
            />
          </div>
        </div>

        <div className={oddsGridClass}>
          <div className="space-y-2">
            <Label htmlFor="betType" className="text-foreground font-medium">
              Tipo de apuesta
            </Label>
            <Select
              value={formData.betType}
              onValueChange={(value: "simple" | "parlay") =>
                setFormData((prev) => ({
                  ...prev,
                  betType: value,
                  legs:
                    value === "simple"
                      ? [
                          prev.legs[0] ?? {
                            market: "",
                            selection: "",
                            odds: "",
                          },
                        ]
                      : prev.legs.length
                        ? prev.legs
                        : [
                            {
                              market: "",
                              selection: "",
                              odds: "",
                            },
                          ],
                }))
              }
              disabled={isAnalyzing}
            >
              <SelectTrigger className="bg-secondary border-border text-foreground">
                <SelectValue placeholder="Selecciona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple</SelectItem>
                <SelectItem value="parlay">Parlay / Combinada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.betType === "simple" && (
            <div className="space-y-2">
              <Label htmlFor="offeredOdds" className="text-foreground font-medium">
                Cuota ofrecida
              </Label>
              <Input
                id="offeredOdds"
                type="number"
                step="0.01"
                placeholder="Ej: 1,85"
                value={formData.offeredOdds}
                onChange={(e) => setFormData({ ...formData, offeredOdds: e.target.value })}
                className="bg-secondary border-border text-foreground"
                disabled={isAnalyzing}
              />
            </div>
          )}
          {formData.betType === "parlay" && (
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Cuota combinada</Label>
              <div className="h-10 px-3 flex items-center rounded-md border border-border bg-secondary text-foreground text-sm">
                {combinedOddsDisplay}
              </div> 
            </div>
          )}
        </div>

        <div className="space-y-3">
          {formData.betType === "parlay" ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Selecciones</p>
                <p className="text-xs text-muted-foreground">Detalla cada mercado incluido en tu apuesta</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addLeg} disabled={isAnalyzing}>
                <Plus className="h-4 w-4 mr-1" />
                Añadir selección
              </Button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-foreground">Selección</p>
          )}

          <div className="space-y-3">
            {formData.legs.map((leg, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border border-border bg-secondary/60 flex flex-col gap-3"
              >
                {formData.betType === "parlay" && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Selección {index + 1}</p>
                    {formData.legs.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeLeg(index)}
                        disabled={isAnalyzing}
                      >
                        <X className="h-4 w-4" />
                        Quitar
                      </Button>
                    )}
                  </div>
                )}
                <div className="grid md:grid-cols-3 gap-3">
                  <Input
                    placeholder="Mercado (ej: Over/Under, 1X2, Handicap)"
                    value={leg.market}
                    onChange={(e) => updateLeg(index, "market", e.target.value)}
                    className="bg-background border-border text-foreground"
                    disabled={isAnalyzing}
                  />
                  <Input
                    placeholder="Selección (ej: Over 2.5, Local ML)"
                    value={leg.selection}
                    onChange={(e) => updateLeg(index, "selection", e.target.value)}
                    className="bg-background border-border text-foreground"
                    disabled={isAnalyzing}
                  />
                  <Input
                    placeholder="Cuota"
                    type="number"
                    step="0.01"
                    value={leg.odds}
                    onChange={(e) => updateLeg(index, "odds", e.target.value)}
                    className="bg-background border-border text-foreground"
                    disabled={isAnalyzing}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-foreground font-medium">
            Contexto opcional
          </Label>
          <Textarea
            id="notes"
            placeholder="Lesiones, clima, motivación, tendencia de mercado, etc."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="bg-secondary border-border text-foreground min-h-[120px] resize-none"
            disabled={isAnalyzing}
          />
        </div>

        <Button
          type="submit"
          disabled={!isFormValid || isAnalyzing}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-lg transition-all hover:shadow-[var(--glow-primary)]"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Analizando Pick...
            </>
          ) : (
            "Valorar Pick"
          )}
        </Button>
      </form>
    </Card>
  );
};
