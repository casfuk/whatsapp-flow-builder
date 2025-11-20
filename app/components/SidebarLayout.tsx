"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface SidebarLayoutProps {
  children: ReactNode;
}

type Section = "dashboard" | "interacciones" | "grupos" | "perfil" | "metrics" | null;

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<Section>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // Determine active section based on route
  useEffect(() => {
    if (pathname === "/dashboard") {
      setActiveSection("dashboard");
    } else if (
      pathname === "/flows" ||
      pathname?.startsWith("/flows/") ||
      pathname === "/flow-builder" ||
      pathname === "/tags" ||
      pathname === "/whalink" ||
      pathname === "/chat" ||
      pathname === "/contactos" ||
      pathname === "/integraciones"
    ) {
      setActiveSection("interacciones");
    } else if (pathname === "/grupos") {
      setActiveSection("grupos");
    } else if (pathname === "/perfil") {
      setActiveSection("perfil");
    } else if (pathname === "/metrics") {
      setActiveSection("metrics");
    }
  }, [pathname]);

  const handleIconClick = (section: Section) => {
    if (section === "dashboard") {
      router.push("/dashboard");
      setActiveSection("dashboard");
    } else if (section === activeSection) {
      // Toggle off if clicking the same icon
      setActiveSection(null);
    } else {
      setActiveSection(section);
    }
  };

  const toggleMenu = (menuKey: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuKey)) {
      newExpanded.delete(menuKey);
    } else {
      newExpanded.add(menuKey);
    }
    setExpandedMenus(newExpanded);
  };

  const renderSidePanelContent = () => {
    switch (activeSection) {
      case "interacciones":
        return (
          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                Interacciones 1 a 1
              </h3>
              <button
                onClick={() => setActiveSection(null)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                title="Colapsar panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <nav className="space-y-1">
              <Link
                href="/chat"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Chat
              </Link>
              <Link
                href="/contactos"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Contactos
              </Link>
              <Link
                href="/tags"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Tags
              </Link>
              <Link
                href="/campos-customizados"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Campos customizados
              </Link>
              <Link
                href="/whalink"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Whalink
              </Link>
              <Link
                href="/flows"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Automatizaciones
              </Link>
              <Link
                href="/flow-builder"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Flow Builder
              </Link>
              <Link
                href="/integraciones"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Integraciones
              </Link>
              <Link
                href="/envio-masivo"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Envío masivo
              </Link>
              <Link
                href="/agentes-ia"
                className="block px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Agentes de IA
              </Link>
            </nav>
          </div>
        );

      case "grupos":
        return (
          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                Grupos y Comunidades
              </h3>
              <button
                onClick={() => setActiveSection(null)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                title="Colapsar panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-400">Contenido próximamente...</p>
          </div>
        );

      case "perfil":
        return (
          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                Perfil
              </h3>
              <button
                onClick={() => setActiveSection(null)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                title="Colapsar panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">WhatsApp personal</label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                  placeholder="+34 000 000 000"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Zona horaria</label>
                <select
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#6D5BFA] focus:border-transparent"
                  defaultValue="Madrid"
                >
                  <option value="Madrid">Madrid</option>
                  <option value="Barcelona">Barcelona</option>
                  <option value="Valencia">Valencia</option>
                  <option value="Sevilla">Sevilla</option>
                </select>
              </div>
            </div>
          </div>
        );

      case "metrics":
        return (
          <div className="p-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                Metrics
              </h3>
              <button
                onClick={() => setActiveSection(null)}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                title="Colapsar panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-400">Contenido próximamente...</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Rail - Icon Sidebar */}
      <div className="w-16 bg-[#1F2937] flex flex-col items-center py-4 space-y-4">
        {/* Dashboard Icon */}
        <button
          onClick={() => handleIconClick("dashboard")}
          className={`p-3 rounded-lg transition-colors ${
            activeSection === "dashboard"
              ? "bg-[#6D5BFA] text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
          title="Tablero principal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </button>

        {/* Interacciones 1 a 1 Icon */}
        <button
          onClick={() => handleIconClick("interacciones")}
          className={`p-3 rounded-lg transition-colors ${
            activeSection === "interacciones"
              ? "bg-[#6D5BFA] text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
          title="Interacciones 1 a 1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </button>

        {/* Grupos y Comunidades Icon */}
        <button
          onClick={() => handleIconClick("grupos")}
          className={`p-3 rounded-lg transition-colors ${
            activeSection === "grupos"
              ? "bg-[#6D5BFA] text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
          title="Grupos y comunidades"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </button>

        {/* Perfil Icon */}
        <button
          onClick={() => handleIconClick("perfil")}
          className={`p-3 rounded-lg transition-colors ${
            activeSection === "perfil"
              ? "bg-[#6D5BFA] text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
          title="Perfil"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {/* Metrics Icon */}
        <button
          onClick={() => handleIconClick("metrics")}
          className={`p-3 rounded-lg transition-colors ${
            activeSection === "metrics"
              ? "bg-[#6D5BFA] text-white"
              : "text-gray-400 hover:text-white hover:bg-gray-700"
          }`}
          title="Metrics"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
            />
          </svg>
        </button>
      </div>

      {/* Expandable Side Panel */}
      {activeSection && activeSection !== "dashboard" && (
        <div className="w-72 bg-[#374151] border-r border-gray-700 overflow-y-auto">
          {renderSidePanelContent()}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
