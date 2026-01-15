import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Settings, TrendingUp, Bell, Shield, Wallet } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Navigation } from "@/components/Navigation";

const Profile = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-lg">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Mi Perfil</h1>
                <p className="text-sm text-muted-foreground">Gestiona tu cuenta y preferencias</p>
              </div>
            </div>
            <Navigation />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sidebar - User Info */}
          <div className="space-y-6">
            {/* Profile Card */}
            <Card className="p-6 bg-card border-border">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-24 w-24 mb-4 ring-2 ring-primary/20">
                  <AvatarImage src="" alt="Usuario" />
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
                    JD
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-bold text-foreground mb-1">Juan Delgado</h2>
                <p className="text-muted-foreground text-sm mb-4">juan.delgado@email.com</p>
                <Button variant="outline" size="sm" className="w-full">
                  Cambiar Avatar
                </Button>
              </div>
            </Card>

            {/* Stats Card */}
            <Card className="p-6 bg-card border-border">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Estadísticas
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Picks Analizados</span>
                    <span className="text-foreground font-semibold">127</span>
                  </div>
                  <Progress value={65} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Tasa de Acierto</span>
                    <span className="text-success font-semibold">68.5%</span>
                  </div>
                  <Progress value={68.5} className="h-2 bg-success/20" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">ROI Total</span>
                    <span className="text-primary font-semibold">+12.3%</span>
                  </div>
                  <Progress value={75} className="h-2" />
                </div>
              </div>
            </Card>

            {/* Bankroll Card */}
            <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Gestión de Bankroll
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Bankroll Inicial</span>
                  <span className="text-foreground font-semibold">€1,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Bankroll Actual</span>
                  <span className="text-success font-semibold text-lg">€1,123</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground text-sm">Ganancia Total</span>
                  <span className="text-success font-semibold">+€123 (+12.3%)</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Información Personal
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input
                    id="firstName"
                    placeholder="Juan"
                    defaultValue="Juan"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellidos</Label>
                  <Input
                    id="lastName"
                    placeholder="Delgado"
                    defaultValue="Delgado"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="juan.delgado@email.com"
                    defaultValue="juan.delgado@email.com"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+34 600 000 000"
                    className="bg-secondary border-border"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Guardar Cambios
                </Button>
              </div>
            </Card>

            {/* Betting Preferences */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Preferencias de Apuestas
              </h3>
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultRisk">Perfil de Riesgo por Defecto</Label>
                    <Select defaultValue="moderate">
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conservative">Conservador</SelectItem>
                        <SelectItem value="moderate">Moderado</SelectItem>
                        <SelectItem value="aggressive">Agresivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultMarket">Mercado Preferido</Label>
                    <Select defaultValue="totals">
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moneyline">Moneyline (1X2)</SelectItem>
                        <SelectItem value="spread">Handicap/Spread</SelectItem>
                        <SelectItem value="totals">Totales (Over/Under)</SelectItem>
                        <SelectItem value="props">Props/Especiales</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankroll">Bankroll Actual (€)</Label>
                    <Input
                      id="bankroll"
                      type="number"
                      placeholder="1000"
                      defaultValue="1123"
                      className="bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxStake">Stake Máximo (%)</Label>
                    <Input
                      id="maxStake"
                      type="number"
                      placeholder="10"
                      defaultValue="10"
                      className="bg-secondary border-border"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold text-foreground">Deportes Favoritos</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {["Fútbol", "Baloncesto", "Tenis", "Fútbol Americano"].map((sport) => (
                      <div key={sport} className="flex items-center justify-between p-3 bg-secondary rounded-lg border border-border">
                        <span className="text-foreground">{sport}</span>
                        <Switch defaultChecked={sport === "Fútbol"} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Guardar Preferencias
                </Button>
              </div>
            </Card>

            {/* Notifications */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notificaciones
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-foreground">Nuevas Recomendaciones</p>
                    <p className="text-sm text-muted-foreground">Recibe alertas de nuevos picks sugeridos</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-foreground">Oportunidades EV+</p>
                    <p className="text-sm text-muted-foreground">Notificaciones de alto valor esperado</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-foreground">Resumen Semanal</p>
                    <p className="text-sm text-muted-foreground">Reporte de rendimiento cada semana</p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between p-4 bg-secondary rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-foreground">Alertas de Stake</p>
                    <p className="text-sm text-muted-foreground">Aviso cuando superes el límite de stake</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </Card>

            {/* Security */}
            <Card className="p-6 bg-card border-border">
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Seguridad
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Contraseña Actual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="••••••••"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nueva Contraseña</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="bg-secondary border-border"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Actualizar Contraseña
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
