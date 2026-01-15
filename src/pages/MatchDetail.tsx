import { useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Brain,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

// Internal Component for Data Bars
const ProbabilityBar = ({ percentage, type }: { percentage: number, type: 'over' | 'under' }) => {
    const isOver = type === 'over';
    const textColor = isOver ? 'text-emerald-400' : 'text-rose-400';
    const barColor = isOver ? 'bg-emerald-500/20' : 'bg-rose-500/20';

    return (
        <div className="relative h-7 w-full flex items-center rounded overflow-hidden">
            <div
                className={`absolute top-0 left-0 h-full ${barColor} transition-all duration-500`}
                style={{ width: `${percentage}%` }}
            />
            <span className={`relative z-10 pl-2 text-xs font-mono font-bold ${textColor}`}>
                {percentage.toFixed(1)}%
            </span>
        </div>
    );
};

interface MatchPrediction {
    xg_home: number,
    xg_away: number,
    win_prob: number,
    draw_prob: number,
    lose_prob: number,
    over_2_5_prob: number,
    btts_prob: number
}

export default function MatchDetail() {
    const { id } = useParams();
    const [marketContext, setMarketContext] = useState<"full" | "home" | "away">("full");
    const [analysis, setAnalysis] = useState<MatchPrediction | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadAnalysis() {
            try {
                if (!id) return;
                const result = await invoke<MatchPrediction>('get_match_analysis', { matchId: parseInt(id) });
                setAnalysis(result);
                setLoading(false);
            } catch (err) {
                console.error("Analysis Failed:", err);
                setError(typeof err === "string" ? err : "Failed to load analysis");
                setLoading(false);
            }
        }
        loadAnalysis();
    }, [id]);

    const ContextSelector = () => (
        <div className="flex justify-center mb-4">
            <div className="bg-muted/50 p-1 rounded-lg inline-flex shadow-sm border border-white/5">
                <Button
                    variant={marketContext === "full" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setMarketContext("full")}
                    className="h-7 text-xs px-3"
                >
                    Partido
                </Button>
                <Button
                    variant={marketContext === "home" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setMarketContext("home")}
                    className="h-7 text-xs px-3"
                >
                    Local
                </Button>
                <Button
                    variant={marketContext === "away" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setMarketContext("away")}
                    className="h-7 text-xs px-3"
                >
                    Visitante
                </Button>
            </div>
        </div>
    );

    const [downloading, setDownloading] = useState(false);

    const handleDownloadData = async () => {
        if (!id) return;
        setDownloading(true);
        try {
            await invoke('analyze_missing_teams', { matchId: parseInt(id) });
            // Reload analysis
            const result = await invoke<MatchPrediction>('get_match_analysis', { matchId: parseInt(id) });
            setAnalysis(result);
            setError(null);
        } catch (err) {
            console.error("Download/Analysis Failed:", err);
            setError(typeof err === "string" ? err : "Failed to download data");
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center animate-fade-in text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                <p>Analyzing Match Data...</p>
            </div>
        );
    }

    if (error || !analysis) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center animate-fade-in text-center px-4">
                <div className="bg-muted/30 p-6 rounded-full mb-6">
                    <TrendingUp className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Análisis Pendiente</h3>
                <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
                    No tenemos historial reciente suficiente de estos equipos en la base de datos local para generar una predicción fiable con el modelo de Poisson.
                </p>
                <Button
                    onClick={handleDownloadData}
                    disabled={downloading}
                    size="lg"
                    className="gap-2 font-semibold"
                >
                    {downloading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analizando Historial...
                        </>
                    ) : (
                        <>
                            <Brain className="h-4 w-4" />
                            Descargar Datos y Analizar
                        </>
                    )}
                </Button>
                {error && error !== "Insufficient data" && (
                    <p className="mt-4 text-xs text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                        Error: {error}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 -mx-6 -mt-6 p-8 border-b border-white/5">
                <div>
                    <Badge className="mb-2 bg-primary/20 text-primary hover:bg-primary/30 border-0">Premier League</Badge>
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mt-1">
                        Arsenal <span className="text-muted-foreground font-light px-2">vs</span> Liverpool
                    </h1>
                    <div className="flex items-center gap-4 mt-3 text-muted-foreground font-medium">
                        <span>Emirates Stadium</span>
                        <span className="text-muted-foreground/30">•</span>
                        <span>12 Mayo, 16:30</span>
                        <span className="text-muted-foreground/30">•</span>
                        <span>Árbitro: A. Taylor</span>
                    </div>
                </div>
                <div className="text-right hidden md:block bg-background px-6 py-4 rounded-xl shadow-sm border border-white/5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Win Probability</div>
                    <div className="flex items-baseline justify-end gap-1">
                        <span className="text-3xl font-bold text-foreground">{(analysis.win_prob * 100).toFixed(0)}%</span>
                        <span className="text-sm font-medium text-muted-foreground">Home</span>
                    </div>
                </div>
            </div>

            {/* Grid: Verdict & Visuals */}
            <Card className="border-amber-500/20 bg-amber-500/5">
                <div className="h-1 w-full bg-amber-500/50 absolute top-0 lg:h-full lg:w-1 lg:left-0 lg:top-0"></div>
                <CardContent className="p-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Verdict */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Brain className="h-5 w-5 text-amber-600" />
                                <h3 className="font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wide text-xs">IA Verdict</h3>
                            </div>
                            <div className="bg-background/50 rounded-lg p-4 border border-amber-500/20 shadow-sm">
                                <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Pick Principal</span>
                                <div className="text-2xl font-extrabold flex items-center gap-2 mt-1">
                                    {analysis.win_prob > 0.5 ? "Home Win" : "Value Play"} <span className="text-emerald-500 text-sm font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{(analysis.win_prob * 100).toFixed(0)}% Prob</span>
                                </div>
                            </div>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-1" />
                                    <span className="text-sm font-medium text-foreground/90">Poisson Model favors Home Advantage ({(analysis.win_prob * 100).toFixed(1)}%).</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <TrendingUp className="h-4 w-4 text-blue-500 shrink-0 mt-1" />
                                    <span className="text-sm font-medium text-foreground/90">xG Output: {analysis.xg_home.toFixed(2)} vs {analysis.xg_away.toFixed(2)}.</span>
                                </li>
                            </ul>
                        </div>
                        {/* Comparison Bars */}
                        <div className="space-y-6 pt-2">
                            <h3 className="font-bold text-muted-foreground uppercase tracking-wide text-xs mb-4">Direct Comparison</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm font-medium">
                                    <span>xG Prediction</span>
                                    <span className="text-primary">Diff: {(analysis.xg_home - analysis.xg_away).toFixed(2)}</span>
                                </div>
                                <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
                                    <div className="h-full bg-primary flex-1 transition-all duration-1000" style={{ width: `${(analysis.xg_home / (analysis.xg_home + analysis.xg_away)) * 100}%` }}></div>
                                    <div className="h-full bg-rose-500 flex-1 transition-all duration-1000" style={{ width: `${(analysis.xg_away / (analysis.xg_home + analysis.xg_away)) * 100}%` }}></div>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                    <span>Home {analysis.xg_home.toFixed(2)}</span>
                                    <span>Away {analysis.xg_away.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Market Explorer */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">Explorador de Mercados</h2>
                    <div className="text-xs text-muted-foreground font-mono">LIVE MODEL OUTPUT</div>
                </div>

                <Tabs defaultValue="main" className="w-full">
                    <TabsList className="bg-muted/50 p-1 h-auto grid grid-cols-3 md:grid-cols-6 w-full md:w-auto gap-1">
                        <TabsTrigger value="main">Principales</TabsTrigger>
                        <TabsTrigger value="goals">Goles</TabsTrigger>
                        {/* Other tabs kept static as they require prop data logic not in analysis struct yet */}
                        <TabsTrigger value="corners">Córners (Mock)</TabsTrigger>
                    </TabsList>

                    {/* MAIN TAB */}
                    <TabsContent value="main" className="mt-6">
                        <Card className="bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead className="w-[300px] text-muted-foreground">MERCADO</TableHead>
                                        <TableHead className="text-muted-foreground">SELECCIÓN</TableHead>
                                        <TableHead className="text-muted-foreground">PROBABILIDAD</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableCell className="font-medium text-foreground">Ganador del Partido (1)</TableCell>
                                        <TableCell className="text-foreground">Home</TableCell>
                                        <TableCell>
                                            <div className="w-[120px]">
                                                <ProbabilityBar percentage={analysis.win_prob * 100} type="over" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableCell className="font-medium text-foreground">Ambos Marcan (BTTS)</TableCell>
                                        <TableCell className="text-foreground">Sí</TableCell>
                                        <TableCell>
                                            <div className="w-[120px]">
                                                <ProbabilityBar percentage={analysis.btts_prob * 100} type="over" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableCell className="font-medium text-foreground">Over 2.5 Goals</TableCell>
                                        <TableCell className="text-foreground">Over</TableCell>
                                        <TableCell>
                                            <div className="w-[120px]">
                                                <ProbabilityBar percentage={analysis.over_2_5_prob * 100} type="over" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>

                    {/* GOALS TAB */}
                    <TabsContent value="goals" className="mt-6 space-y-4">
                        <ContextSelector />
                        <Card className="bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-white/5 hover:bg-transparent">
                                        <TableHead className="w-[150px] text-muted-foreground">LÍNEA</TableHead>
                                        <TableHead className="text-muted-foreground w-[200px]">OVER %</TableHead>
                                        <TableHead className="text-muted-foreground w-[200px]">UNDER %</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[2.5].map(line => {
                                        // For demo, standardizing on 2.5 since analysis struct has it specific
                                        // In full implementation, analysis would return array of probs
                                        const overProb = analysis.over_2_5_prob * 100;
                                        const underProb = 100 - overProb;

                                        return (
                                            <TableRow key={line} className="border-white/5 hover:bg-transparent h-12">
                                                <TableCell className="font-mono text-foreground font-medium">{line}</TableCell>
                                                <TableCell className="p-2">
                                                    <ProbabilityBar percentage={overProb} type="over" />
                                                </TableCell>
                                                <TableCell className="p-2">
                                                    <ProbabilityBar percentage={underProb} type="under" />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </Card>
                    </TabsContent>

                    {/* Mock Content for other tabs to prevent errors */}
                    <TabsContent value="corners" className="mt-6">
                        <div className="p-4 text-center text-muted-foreground">Corner analysis coming in v2 provider update. (Not implemented in Poisson Model yet)</div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
