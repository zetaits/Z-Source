import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Calendar, MapPin } from "lucide-react";

export interface MatchData {
    id: string;
    home: string;
    away: string;
    date: string;
    venue: string;
    time?: string; // Added field
    score: string;
    status: string;
    xg: { home: number | null; away: number | null };
    probability?: number;
}

interface MatchCardProps {
    match: MatchData;
}

export function MatchCard({ match }: MatchCardProps) {
    // Dynamic Badge Color Logic
    let badgeVariant = "default";
    let badgeClass = "";
    let badgeText = match.status;

    if (match.status.includes("Analizado") || match.probability) {
        badgeVariant = "default"; // Gold/Amber feel
        badgeClass = "bg-amber-500 hover:bg-amber-600 text-white border-none shadow-sm shadow-amber-500/20";
        // If probability is present, override text to show statistical confidence
        if (match.probability) {
            badgeText = `🎯 Prob: ${match.probability}%`;
        }
    } else if (match.status.includes("Finalizado")) {
        badgeVariant = "secondary";
        badgeClass = "bg-slate-700/50 text-slate-400 hover:bg-slate-700/70 border-slate-700";
    } else if (match.status.includes("Programado")) {
        badgeVariant = "outline";
        badgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20";
    } else if (match.status.includes("Pospuesto")) {
        badgeVariant = "destructive";
        badgeClass = "opacity-70";
    }

    return (
        <Link to={`/match/${match.id}`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-l-4 border-l-primary/50 hover:border-l-primary h-full">
                <CardHeader className="pb-2 relative">
                    {/* Status Dot */}
                    <div className={`absolute top-3 right-3 h-2 w-2 rounded-full ${match.status === "Analizado" ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />

                    <div className="flex justify-between items-center mb-2 pr-4">
                        <Badge variant={badgeVariant as any} className={badgeClass}>
                            {match.probability ? <span className="font-bold">{badgeText}</span> : badgeText}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {match.date.split("-")[0]}
                            {match.time && match.time !== "" && <span className="ml-1 text-foreground font-medium">• {match.time}</span>}
                        </span>
                    </div>
                    <CardTitle className="text-xl flex justify-between items-center">
                        <span className="truncate max-w-[45%]">{match.home}</span>
                        <span className="mx-2 text-muted-foreground text-sm shrink-0">vs</span>
                        <span className="truncate max-w-[45%] text-right">{match.away}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4 bg-muted/20 rounded-md mb-4">
                        <span className={match.score === "vs" ? "text-xl font-medium text-muted-foreground italic" : "text-3xl font-bold tracking-widest"}>
                            {match.score}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 h-4">
                        {match.venue && match.venue !== "Unknown Venue" && (
                            <>
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{match.venue}</span>
                            </>
                        )}
                    </div>
                    {match.xg.home && (
                        <div className="mt-3 text-xs flex justify-between px-2 pt-2 border-t">
                            <span className="text-muted-foreground">xG: <span className="text-foreground font-mono">{match.xg.home}</span></span>
                            <span className="text-muted-foreground">xG: <span className="text-foreground font-mono">{match.xg.away}</span></span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
