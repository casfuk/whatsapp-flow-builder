"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + "/");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">FunnelChat</h1>
        </div>

        <nav className="flex-1 p-4 space-y-6">
          {/* INTERACCIONES 1 A 1 */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Interacciones 1 a 1
            </div>
            <div className="space-y-1">
              <Link
                href="/flows"
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive("/flows")
                    ? "bg-[#6D5BFA] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Automatizaciones
              </Link>
              <Link
                href="/tags"
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive("/tags")
                    ? "bg-[#6D5BFA] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Tags
              </Link>
              <Link
                href="/whalink"
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive("/whalink")
                    ? "bg-[#6D5BFA] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                Whalink
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
