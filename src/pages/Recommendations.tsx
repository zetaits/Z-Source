import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Clock, Target, ChevronRight } from "lucide-react";
import { Navigation } from "@/components/Navigation";

const mockRecommendations = [
  {
    id: 1,
    title: "Real Madrid vs Atlético Madrid",
    market: "Over 2.5 Goles",
    odds: 1.92,
    confidence: 85,
    stake: 4,
    league: "La Liga",
    timeUntilStart: "2h 15m",
    reasoning: "Ambos equipos con alta efectividad ofensiva. Últimos 5 enfrentamientos: 4 con más de 2.5 goles.",
    evPercentage: "+12.5%"
  },
  {
    id: 2,
    title: "Barcelona vs Sevilla",
    market: "Barcelona -1 Handicap",
    odds: 2.10,
    confidence: 78,
    stake: 3,
    league: "La Liga",
    timeUntilStart: "5h 30m",
    reasoning: "Barcelona dominante en casa. Sevilla con 3 bajas importantes en defensa.",
    evPercentage: "+8.3%"
  },
  {
    id: 3,
    title: "Manchester City vs Arsenal",
    market: "Ambos equipos marcan",
    odds: 1.75,
    confidence: 72,
    stake: 3,
    league: "Premier League",
    timeUntilStart: "1 día 3h",
    reasoning: "Ambos equipos con líneas ofensivas potentes. Historial reciente favorable.",
    evPercentage: "+6.8%"
  },
  {
    id: 4,
    title: "Bayern Munich vs Dortmund",
    market: "Over 3.5 Goles",
    odds: 2.35,
    confidence: 68,
    stake: 2,
    league: "Bundesliga",
    timeUntilStart: "2 días",
    reasoning: "Clásico alemán históricamente con muchos goles. Ambos equipos en excelente forma ofensiva.",
    evPercentage: "+5.2%"
  }
];

const Recommendations = () => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-success";
    if (confidence >= 70) return "text-primary";
    return "text-warning";
  };

  const getConfidenceBgColor = (confidence: number) => {
    if (confidence >= 80) return "bg-success/10 border-success/20";
    if (confidence >= 70) return "bg-primary/10 border-primary/20";
    return "bg-warning/10 border-warning/20";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-lg">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Recomendaciones IA</h1>
                <p className="text-sm text-muted-foreground">Oportunidades detectadas por nuestro sistema</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                {mockRecommendations.length} Picks Activos
              </Badge>
              <Navigation />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Valor EV+ Promedio</p>
                <p className="text-3xl font-bold text-success">+8.2%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Confianza Media</p>
                <p className="text-3xl font-bold text-primary">75.8%</p>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm mb-1">Próximo Pick</p>
                <p className="text-3xl font-bold text-warning">2h 15m</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </Card>
        </div>

        {/* Recommendations List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Picks Recomendados</h2>
            <Button variant="outline" size="sm" className="text-muted-foreground">
              Filtrar
            </Button>
          </div>

          {mockRecommendations.map((rec, index) => (
            <Card 
              key={rec.id} 
              className="p-6 bg-card border-border hover:border-primary/40 transition-all cursor-pointer group animate-in fade-in-50"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Main Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                        {rec.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-secondary text-secondary-foreground">
                          {rec.league}
                        </Badge>
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          {rec.market}
                        </Badge>
                      </div>
                    </div>
                    <Badge className={`${getConfidenceBgColor(rec.confidence)} ${getConfidenceColor(rec.confidence)} border`}>
                      {rec.confidence}% Confianza
                    </Badge>
                  </div>

                  <p className="text-muted-foreground text-sm mb-3">{rec.reasoning}</p>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">{rec.timeUntilStart}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground font-medium">Stake: {rec.stake}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-success" />
                      <span className="text-success font-medium">EV {rec.evPercentage}</span>
                    </div>
                  </div>
                </div>

                {/* Odds and Action */}
                <div className="flex lg:flex-col items-center lg:items-end gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border lg:pl-6">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs mb-1">Cuota</p>
                    <p className="text-3xl font-bold text-primary">{rec.odds.toFixed(2)}</p>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground group-hover:shadow-[var(--glow-primary)] transition-all">
                    Ver Análisis
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State for when no recommendations */}
        {mockRecommendations.length === 0 && (
          <Card className="p-12 text-center bg-card/50">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No hay recomendaciones disponibles
            </h3>
            <p className="text-muted-foreground">
              El sistema está buscando oportunidades. Vuelve pronto para ver nuevas recomendaciones.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Recommendations;
