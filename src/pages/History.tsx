import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation } from "@/components/Navigation";
import { History as HistoryIcon, Search, Filter, TrendingUp, TrendingDown } from "lucide-react";

const mockHistory = [
  {
    id: 1,
    title: "Liverpool vs Chelsea - Over 2.5",
    date: "2024-01-15",
    odds: 1.85,
    stake: 4,
    result: "Ganado",
    profit: "+3.40",
    market: "Totales",
  },
  {
    id: 2,
    title: "PSG -1 Handicap",
    date: "2024-01-14",
    odds: 2.10,
    stake: 3,
    result: "Perdido",
    profit: "-3.00",
    market: "Handicap",
  },
  {
    id: 3,
    title: "Real Madrid vs Barcelona - 1X2",
    date: "2024-01-13",
    odds: 2.50,
    stake: 5,
    result: "Ganado",
    profit: "+7.50",
    market: "Moneyline",
  },
];

const History = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-lg">
                <HistoryIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Historial de Picks</h1>
                <p className="text-sm text-muted-foreground">Revisa todos tus anǭlisis anteriores</p>
              </div>
            </div>
            <Navigation />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en historial..."
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>

        {/* History Table */}
        <Card className="p-6 bg-card border-border">
          <div className="space-y-4">
            {mockHistory.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-secondary rounded-lg border border-border hover:bg-secondary/80 transition-all"
              >
                <div className="flex-1 mb-3 sm:mb-0">
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge variant="outline" className="bg-muted">
                      {item.market}
                    </Badge>
                    <span className="text-muted-foreground">{item.date}</span>
                    <span className="text-foreground">Cuota: {item.odds}</span>
                    <span className="text-foreground">Stake: {item.stake}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge
                    className={
                      item.result === "Ganado"
                        ? "bg-success/20 text-success border-success/30"
                        : "bg-destructive/20 text-destructive border-destructive/30"
                    }
                  >
                    {item.result}
                  </Badge>
                  <div
                    className={`flex items-center gap-1 font-semibold ${
                      item.profit.startsWith("+") ? "text-success" : "text-destructive"
                    }`}
                  >
                    {item.profit.startsWith("+") ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {item.profit}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Empty State */}
        {mockHistory.length === 0 && (
          <Card className="p-12 text-center bg-card/50">
            <HistoryIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No hay historial disponible
            </h3>
            <p className="text-muted-foreground">
              Comienza analizando picks para ver tu historial aqu��.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
};

export default History;
