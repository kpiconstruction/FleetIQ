import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import {
  LayoutDashboard,
  Truck,
  ClipboardCheck,
  Wrench,
  Clock,
  Activity,
  Fuel,
  Settings,
  ChevronDown,
  Menu,
  X,
  Building2,
  FileText,
  Users,
  Sun,
  Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ThemeProvider, useTheme } from "./components/ThemeProvider";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Vehicles", icon: Truck, page: "Vehicles" },
  { name: "Prestarts", icon: ClipboardCheck, page: "Prestarts" },
  { name: "Maintenance Overview", icon: Activity, page: "MaintenanceOverview" },
  { name: "Maintenance Control", icon: Wrench, page: "MaintenanceOperationalControl" },
  { name: "Maintenance Planner", icon: Wrench, page: "MaintenancePlanner" },
  { name: "Service", icon: Wrench, page: "Service" },
  { name: "Downtime", icon: Clock, page: "Downtime" },
  { name: "Usage", icon: Activity, page: "Usage" },
  { name: "Fuel", icon: Fuel, page: "Fuel" },
];

const safetyItems = [
  { name: "High-Risk Workers", icon: Users, page: "HighRiskWorkers" },
];

const adminItems = [
  { name: "Hire Providers", icon: Building2, page: "HireProviders" },
  { name: "Contracts", icon: FileText, page: "Contracts" },
];

function LayoutContent({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const isActive = (pageName) => currentPageName === pageName;

  const NavLink = ({ item, onClick }) => (
    <Link
      to={createPageUrl(item.page)}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive(item.page)
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50"
          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
      }`}
    >
      <item.icon className="w-5 h-5" />
      {item.name}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-slate-100">KPI - Fleet IQ</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-slate-600 dark:text-slate-400"
            >
              {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl text-slate-900 dark:text-slate-100">KPI - Fleet IQ</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Fleet Management System</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.page} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

            {/* Safety & HVNL Section */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Safety & HVNL</p>
            </div>
            {safetyItems.map((item) => (
              <NavLink key={item.page} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

            {/* Admin Section */}
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5" />
                  Admin
                </div>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    adminOpen ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 space-y-1 pt-1">
                {adminItems.map((item) => (
                  <NavLink key={item.page} item={item} onClick={() => setSidebarOpen(false)} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 border border-indigo-100 dark:border-indigo-900">
              <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">KPI Group</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Traffic Management & Construction</p>
            </div>
            <div className="mt-3 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="w-full justify-start gap-2 text-slate-600 dark:text-slate-400"
              >
                {theme === "light" ? (
                  <>
                    <Moon className="w-4 h-4" />
                    <span className="text-xs">Dark Mode</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4" />
                    <span className="text-xs">Light Mode</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:pl-72 pt-16 lg:pt-0">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <ThemeProvider>
      <LayoutContent children={children} currentPageName={currentPageName} />
    </ThemeProvider>
  );
}