import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Calendar, MapPin } from "lucide-react";

// Mock Data
const MOCK_MATCHES = [
    {
        id: "match-1",
        home: "Arsenal",
        away: "Liverpool",
        date: "Domingo, 12 Mayo - 16:30",
        venue: "Emirates Stadium",
        score: "3 - 1",
        status: "Finalizado",
        xg: { home: 2.8, away: 0.9 }
    },
    {
        id: "match-2",
        home: "Man City",
        away: "Tottenham",
        date: "Martes, 14 Mayo - 20:00",
        venue: "Etihad Stadium",
        score: "-",
        status: "Programado",
        xg: { home: null, away: null }
    },
    {
        id: "match-3",
        home: "Real Madrid",
        away: "Barcelona",
        date: "Sábado, 18 Mayo - 21:00",
        venue: "Santiago Bernabéu",
        score: "2 - 2",
        status: "En Vivo (75')",
        xg: { home: 1.5, away: 1.4 }
    }
];

export default function DashboardMatches() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Fútbol: Partidos Recientes</h2>
                <Badge variant="outline" className="text-lg px-4 py-1">Temporada 24/25</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {MOCK_MATCHES.map((match) => (
                    <Link key={match.id} to={`/match/${match.id}`}>
                        <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-l-4 border-l-primary/50 hover:border-l-primary">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-center mb-2">
                                    <Badge variant={match.status.includes("Finalizado") ? "secondary" : "default"}>
                                        {match.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {match.date.split("-")[0]}
                                    </span>
                                </div>
                                <CardTitle className="text-xl flex justify-between items-center">
                                    <span>{match.home}</span>
                                    <span className="mx-2 text-muted-foreground text-sm">vs</span>
                                    <span>{match.away}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-4 bg-muted/20 rounded-md mb-4">
                                    <span className="text-3xl font-bold tracking-widest">{match.score}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {match.venue}
                                </div>
                                {match.xg.home && (
                                    <div className="mt-3 text-xs flex justify-between px-2">
                                        <span>xG: {match.xg.home}</span>
                                        <span>xG: {match.xg.away}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
