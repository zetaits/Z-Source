import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MatchCard, MatchData } from "@/components/MatchCard";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// MatchPreview from API
interface MatchPreview {
    id: number;
    date: string;
    home_team: string;
    away_team: string;
    score: string;
    status: string;
    xg_home: number | null;
    xg_away: number | null;
}

export default function MatchesPage() {
    const [selectedLeague, setSelectedLeague] = useState("premier-league");
    const [matches, setMatches] = useState<MatchData[]>([]);
    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);

    async function loadMatches() {
        try {
            setLoading(true);
            const data = await invoke<MatchPreview[]>('get_all_matches');
            const uiMatches: MatchData[] = data.map(m => ({
                id: m.id.toString(),
                home: m.home_team,
                away: m.away_team,
                date: m.date,
                venue: "Unknown Venue",
                score: m.score,
                status: m.status as any,
                xg: { home: m.xg_home, away: m.xg_away }
            }));
            setMatches(uiMatches);
        } catch (err) {
            console.error("Failed", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadMatches();
    }, []);

    const handleRefreshFixtures = async () => {
        try {
            setRefreshing(true);
            const url = "https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures";
            const count = await invoke<number>('fetch_upcoming_matches', { leagueUrl: url });
            alert(`Sincronización Completada: ${count} partidos actualizados/agregados.`);
            await loadMatches();
        } catch (error) {
            console.error("Failed to refresh fixtures", error);
            alert(`Error al sincronizar: ${error}`);
        } finally {
            setRefreshing(false);
        }
    };

    // Grouping Logic
    const groupedMatches = matches.reduce((groups, match) => {
        // Date parsing might need adjustment based on scraper format ('2024-01-01' or complex)
        // Ensure valid date or fallback
        const dateObj = new Date(match.date);
        const isValidDate = !isNaN(dateObj.getTime());
        const dateKey = isValidDate
            ? dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
            : match.date; // Fallback to raw string if parse fails

        // Capitalize first letter
        const dateHeader = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);

        if (!groups[dateHeader]) {
            groups[dateHeader] = [];
        }
        groups[dateHeader].push(match);
        return groups;
    }, {} as Record<string, MatchData[]>);

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6 animate-fade-in">
            {/* Left Sidebar: League Explorer */}
            <div className="w-1/4 min-w-[250px] hidden md:flex flex-col gap-4 border-r pr-4">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar Liga..." className="pl-8" />
                </div>
                <ScrollArea className="h-full pr-3">
                    <Accordion type="single" collapsible defaultValue="england" className="w-full">
                        <AccordionItem value="england" className="border-b-0">
                            <AccordionTrigger className="hover:no-underline py-2 text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center gap-2">
                                <span>🇬🇧</span> Inglaterra
                            </AccordionTrigger>
                            <AccordionContent className="pb-0">
                                <div className="flex flex-col gap-1 pl-2 border-l-2 ml-1">
                                    <button
                                        onClick={() => setSelectedLeague("premier-league")}
                                        className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedLeague === 'premier-league' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}
                                    >
                                        Premier League
                                    </button>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </ScrollArea>
            </div>

            {/* Right Content: Match List */}
            <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Partidos</h2>
                        <p className="text-muted-foreground text-sm">Base de datos local</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefreshFixtures}
                            disabled={refreshing}
                        >
                            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Loader2 className="mr-2 h-4 w-4" />}
                            {refreshing ? "Sincronizando..." : "Sincronizar Fixtures"}
                        </Button>
                        <Badge variant="outline" className="text-sm px-3 py-1 bg-background">{matches.length} Matches</Badge>
                    </div>
                </div>

                <ScrollArea className="h-full pb-10">
                    <div className="space-y-8 pr-4">
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <Loader2 className="animate-spin h-8 w-8 text-primary" />
                            </div>
                        ) : Object.keys(groupedMatches).length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground">
                                No hay partidos en la base de datos.
                            </div>
                        ) : (
                            Object.entries(groupedMatches).map(([date, matches]) => (
                                <div key={date} className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="rounded-sm bg-muted text-muted-foreground uppercase text-[10px] tracking-widest border-0">Fecha</Badge>
                                        <h4 className="font-semibold text-sm text-foreground/80">{date}</h4>
                                    </div>
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        {matches.map(match => (
                                            <MatchCard key={match.id} match={match} />
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}

