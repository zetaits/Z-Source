import { useState } from "react";
import { PickAnalyzerForm, PickFormData } from "@/components/PickAnalyzerForm";
import { AnalysisResults } from "@/components/AnalysisResults";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { Navigation } from "@/components/Navigation";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

interface Analysis {
  recommendedStake: string;
  isEvPositive: boolean;
  fairOdds: string;
  valueVerdict: string;
  executiveSummary: string;
  evOpportunities: string[];
  advancedSignals: string[];
  actionPlan: string[];
}

const Index = () => {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async (formData: PickFormData) => {
    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-pick", {
        body: formData,
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(data);
      toast({
        title: "Análisis completado",
        description: "Tu pick ha sido analizado exitosamente.",
      });
    } catch (error) {
      console.error("Error analyzing pick:", error);
      toast({
        title: "Error en el análisis",
        description: error instanceof Error ? error.message : "No se pudo completar el análisis. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <OnboardingDialog />
      
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-lg">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">LyraTip Command Center</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">Análisis inteligente de apuestas deportivas</p>
              </div>
            </div>
            <Navigation />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {/* Form Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Analizador de picks</h2>
              <p className="text-muted-foreground">
                Introduce tu apuesta para recibir un análisis profesional: valor esperado, cuota justa y plan de acción.
              </p>
            </div>
            <PickAnalyzerForm onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Resultados del análisis</h2>
              <p className="text-muted-foreground">
                {analysis 
                  ? "Revisa las recomendaciones y señales detectadas por nuestro sistema."
                  : "Los resultados aparecerán aquí una vez completes el análisis."}
              </p>
            </div>
            
            {analysis ? (
              <AnalysisResults analysis={analysis} />
            ) : (
              <div className="flex items-center justify-center h-[400px] border-2 border-dashed border-border rounded-lg bg-card/30">
                <div className="text-center space-y-2">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                  <p className="text-muted-foreground">Esperando análisis...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            LyraTip Command Center - Análisis Profesional de Apuestas Deportivas
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
