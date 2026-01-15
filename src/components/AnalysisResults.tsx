import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, CheckCircle2, Target } from "lucide-react";

interface AnalysisResultsProps {
  analysis: {
    recommendedStake: string;
    isEvPositive: boolean;
    fairOdds: string;
    valueVerdict: string;
    executiveSummary: string;
    evOpportunities: string[];
    advancedSignals: string[];
    actionPlan: string[];
  };
}

export const AnalysisResults = ({ analysis }: AnalysisResultsProps) => {
  const stakeValue = parseFloat(analysis.recommendedStake);
  const getStakeColor = () => {
    if (stakeValue <= 3) return "text-warning";
    if (stakeValue <= 6) return "text-success";
    return "text-primary";
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-700">
      {/* Value verdict and stake */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -z-10" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium mb-2">Stake recomendado</p>
              <p className={`text-5xl font-bold ${getStakeColor()} transition-all`}>
                {analysis.recommendedStake}%
              </p>
              <p className="text-muted-foreground text-sm mt-2">del bankroll</p>
            </div>
            <div className="bg-primary/10 p-3 rounded-xl">
              <Target className="h-7 w-7 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground">Valor esperado</h3>
            <Badge variant={analysis.isEvPositive ? "default" : "outline"} className={analysis.isEvPositive ? "bg-success text-success-foreground" : "text-warning border-warning/40"}>
              {analysis.isEvPositive ? "EV +" : "EV -"}
            </Badge>
          </div>
          <p className="text-foreground/90 font-medium">{analysis.valueVerdict}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Cuota justa estimada: <span className="font-semibold text-foreground">{analysis.fairOdds}</span>
          </p>
        </Card>
      </div>

      {/* Executive Summary */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">Resumen Ejecutivo</h3>
        </div>
        <p className="text-foreground/90 leading-relaxed">{analysis.executiveSummary}</p>
      </Card>

      {/* EV+ Opportunities */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-success" />
          <h3 className="text-xl font-semibold text-foreground">Oportunidades EV+</h3>
        </div>
        <div className="space-y-3">
          {analysis.evOpportunities.map((opportunity, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 bg-success/5 border border-success/20 rounded-lg transition-all hover:bg-success/10"
            >
              <Badge variant="outline" className="bg-success/20 text-success border-success/30 mt-0.5">
                {index + 1}
              </Badge>
              <p className="text-foreground/90 flex-1">{opportunity}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Advanced Signals */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h3 className="text-xl font-semibold text-foreground">Señales Avanzadas</h3>
        </div>
        <div className="space-y-3">
          {analysis.advancedSignals.map((signal, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 bg-secondary border border-border rounded-lg transition-all hover:bg-secondary/80"
            >
              <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30 mt-0.5">
                {index + 1}
              </Badge>
              <p className="text-foreground/90 flex-1">{signal}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Action Plan */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-semibold text-foreground">Plan de Acción</h3>
        </div>
        <div className="space-y-3">
          {analysis.actionPlan.map((action, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg transition-all hover:bg-primary/10"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary font-semibold text-sm mt-0.5">
                {index + 1}
              </div>
              <p className="text-foreground/90 flex-1">{action}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
