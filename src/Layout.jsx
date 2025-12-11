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
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Vehicles", icon: Truck, page: "Vehicles" },
  { name: "Prestarts", icon: ClipboardCheck, page: "Prestarts" },
  { name: "Service", icon: Wrench, page: "Service" },
  { name: "Downtime", icon: Clock, page: "Downtime" },
  { name: "Usage", icon: Activity, page: "Usage" },
  { name: "Fuel", icon: Fuel, page: "Fuel" },
];

const adminItems = [
  { name: "Hire Providers", icon: Building2, page: "HireProviders" },
  { name: "Contracts", icon: FileText, page: "Contracts" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const isActive = (pageName) => currentPageName === pageName;

  const NavLink = ({ item, onClick }) => (
    <Link
      to={createPageUrl(item.page)}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
        isActive(item.page)
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <item.icon className="w-5 h-5" />
      {item.name}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">KPI Fleet Hub</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl text-slate-900">KPI Fleet Hub</h1>
                <p className="text-xs text-slate-500">Fleet Management System</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.page} item={item} onClick={() => setSidebarOpen(false)} />
            ))}

            {/* Admin Section */}
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all duration-200">
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
          <div className="p-4 border-t border-slate-100">
            <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50">
              <p className="text-xs font-medium text-indigo-600">KPI Group</p>
              <p className="text-xs text-slate-500">Traffic Management & Construction</p>
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