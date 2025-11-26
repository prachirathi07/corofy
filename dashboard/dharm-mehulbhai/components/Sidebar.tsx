'use client';

// import { useState } from 'react';
import { ChevronLeft, ChevronRight, Home, Database, BarChart3, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  
  const menuItems = [
    { icon: Home, label: 'Dashboard', href: '/' },
    { icon: Database, label: 'Database', href: '/database' },
    { icon: BarChart3, label: 'Analytics', href: '/analytics' },
  ];

  return (
    <div className={`
      bg-slate-900 text-white h-screen transition-all duration-300 ease-in-out
      ${isCollapsed ? 'w-16' : 'w-64'}
      flex flex-col
    `}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-white">
              Corofy Dashboard
            </h1>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={index}>
                <Link
                  href={item.href}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'hover:bg-slate-700 text-slate-300'
                    }
                    ${isCollapsed ? 'justify-center' : 'justify-start'}
                  `}
                >
                  <IconComponent className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-medium">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        {!isCollapsed && (
          <div className="text-xs text-slate-400 mb-4">
            <p>Chemical Products</p>
            <p>Management System</p>
          </div>
        )}
        
        {/* User Info and Logout */}
        <div className="space-y-2">
          {!isCollapsed && user && (
            <div className="text-sm text-slate-300 mb-2">
              <p className="font-medium">Welcome, {user}</p>
            </div>
          )}
          
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-red-600 text-slate-300 hover:text-white"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && (
              <span className="font-medium">Logout</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}