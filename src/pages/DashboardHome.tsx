import { Badge } from "@/components/ui/badge";
import { MatchCard, MatchData } from "@/components/MatchCard";
import { Activity, RefreshCw, TrendingUp, Database, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

// Type definition for API response
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

const PERFORMANCE_DATA = [
    { name: 'Mon', profit: 10 },
    { name: 'Tue', profit: 25 },
    { name: 'Wed', profit: 15 },
    { name: 'Thu', profit: 35 },
    { name: 'Fri', profit: 45 },
    { name: 'Sat', profit: 60 },
    { name: 'Sun', profit: 55 },
];

export default function DashboardHome() {
    const [matches, setMatches] = useState<MatchData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSport, setSelectedSport] = useState("football");

    useEffect(() => {
        async function loadMatches() {
            setLoading(true); // Reset loading when sport changes
            try {
                // Future: pass { sport: selectedSport } argument
                const data = await invoke<MatchPreview[]>('get_all_matches');
                
                // Transform API data to UI MatchData format
                const uiMatches: MatchData[] = data.map(m => ({
                    id: m.id.toString(),
                    home: m.home_team,
                    away: m.away_team,
                    date: m.date,
                    venue: "Unknown Venue", 
                    score: m.score,
                    status: m.status as any,
                    probability: m.status === 'Analizado' ? 85 : undefined,
                    xg: { home: m.xg_home, away: m.xg_away }
                }));
                // Show top 6 matches for better visibility
                setMatches(uiMatches.slice(0, 6));
            } catch (err) {
                console.error("Failed to load matches", err);
            } finally {
                setLoading(false);
            }
        }
        loadMatches();
    }, [selectedSport]);

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Sport Selector */}
            <div className="flex justify-center md:justify-start">
                 <Tabs value={selectedSport} onValueChange={setSelectedSport} className="w-[400px]">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="football">Football</TabsTrigger>
                        <TabsTrigger value="basketball" disabled>Basketball</TabsTrigger>
                        <TabsTrigger value="tennis" disabled>Tennis</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Header with Health Check */}
            <div className="flex flex-col md:flex-row justify-between md:items-start gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Executive Summary</h2>
                    <p className="text-muted-foreground">Estado del sistema y rendimiento del modelo ({selectedSport}).</p>
                </div>

                {/* Health Check Widget */}
                <Card className="w-full md:w-auto min-w-[300px] border-l-4 border-l-green-500 bg-background/50 backdrop-blur">
                    <CardHeader className="py-3">
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 font-medium">
                                <Database className="h-4 w-4 text-green-500" />
                                DB Status: Healthy
                            </div>
                            <span className="text-xs text-muted-foreground">Hace 2 horas</span>
                        </div>
                    </CardHeader>
                    <CardContent className="py-2 pb-3">
                        <div className="flex justify-between items-center gap-4">
                            <div className="text-xs text-muted-foreground">
                                Última sincronización: <br />
                                <span className="font-mono text-foreground">Live Data</span>
                            </div>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                <RefreshCw className="h-3 w-3" />
                                Forzar Update
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Chart Section */}
            <div className="grid gap-4 md:grid-cols-7">
                <Card className="col-span-4 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Model Performance (Accuracy)
                        </CardTitle>
                        <CardDescription>Precisión del modelo en predicciones sobre 70%.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-0">
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={PERFORMANCE_DATA}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                    />
                                    <Area type="monotone" dataKey="profit" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* KPI Cards */}
                <div className="col-span-3 space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Analizados</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{matches.length}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-green-500" />
                                +{matches.length} this session
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Confianza Media</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-amber-500">68%</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Promedio global
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Value Radar Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                        Live Matches (DB)
                    </h3>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : matches.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground border border-dashed rounded-lg">
                        No matches found in database. Run scraper.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-3">
                        {matches.map((match) => (
                            <MatchCard key={match.id} match={match} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

