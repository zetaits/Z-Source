import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
    return (
        <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
                <div className="p-4 border-b flex items-center gap-2">
                    <SidebarTrigger />
                    <h1 className="font-semibold text-lg">Panel de Control</h1>
                </div>
                <div className="p-6 bg-background min-h-[calc(100vh-65px)]">
                    <Outlet />
                </div>
            </main>
        </SidebarProvider>
    );
}
