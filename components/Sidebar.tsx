import React from 'react';
import { AppView } from '../types';
import { MessageSquare, Briefcase, FileText, Settings, Sparkles, Gift } from 'lucide-react';
import { APP_VERSION } from '../constants';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onShowUpdates?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, onShowUpdates }) => {
  const navItems = [
    { id: AppView.CHAT, label: 'Chat', icon: MessageSquare },
    { id: AppView.JOBS, label: 'Jobs', icon: Briefcase },
    { id: AppView.RESUME, label: 'Resume', icon: FileText },
    { id: AppView.SETTINGS, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="bg-white border-r border-gray-200 flex flex-col h-full shrink-0 transition-all duration-300 w-16 md:w-64">
      <div className="p-4 md:p-6 flex items-center justify-center md:justify-start gap-2 border-b border-gray-100 h-16 md:h-auto">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm">
          <Sparkles size={18} />
        </div>
        <div className="hidden md:block">
           <h1 className="font-bold text-xl tracking-tight text-gray-900 leading-none">JobRight</h1>
           <button onClick={onShowUpdates} className="text-[10px] text-gray-500 hover:text-brand-600 font-medium">v{APP_VERSION}</button>
        </div>
      </div>

      <nav className="flex-1 p-2 md:p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            title={item.label}
            className={`w-full flex items-center justify-center md:justify-start gap-3 px-2 md:px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentView === item.id
                ? 'bg-brand-50 text-brand-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <item.icon size={20} className="shrink-0" />
            <span className="hidden md:block">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-2 md:p-4 border-t border-gray-100 space-y-2">
        {/* Update Trigger */}
        <button 
           onClick={onShowUpdates} 
           className="w-full flex items-center justify-center md:justify-start gap-3 px-2 md:px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-brand-600 transition-colors group"
        >
            <Gift size={20} className="text-gray-400 group-hover:text-brand-500" />
            <span className="hidden md:block">What's New</span>
        </button>

        <div className="bg-brand-50 rounded-xl p-4 hidden md:block">
          <h4 className="font-semibold text-brand-800 text-xs mb-1">Extension Mode</h4>
          <p className="text-[10px] text-brand-600 mb-2 leading-tight">Running locally.</p>
          <button onClick={() => onViewChange(AppView.SETTINGS)} className="w-full bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-bold py-1.5 rounded-lg">Config</button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;