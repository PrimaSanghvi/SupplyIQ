import { useMemo } from 'react';
import { LayoutDashboard, Network, GitCompare, Sliders, ArrowRightLeft, Activity, ShieldAlert, MessageCircle, BookOpen, Zap, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { getBrand } from '../../config/branding';

type Page = 'dashboard' | 'network' | 'scenarios' | 'optimizer' | 'movements' | 'simulation' | 'risk' | 'chat' | 'glossary';

const NAV_ITEMS: { id: Page; label: string; Icon: typeof Network }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'network', label: 'Network', Icon: Network },
  { id: 'scenarios', label: 'Scenarios', Icon: GitCompare },
  { id: 'optimizer', label: 'Optimizer', Icon: Sliders },
  { id: 'movements', label: 'Movements', Icon: ArrowRightLeft },
  { id: 'simulation', label: 'Simulation', Icon: Activity },
  { id: 'risk', label: 'Risk Insights', Icon: ShieldAlert },
  { id: 'chat', label: 'Explainer', Icon: MessageCircle },
  { id: 'glossary', label: 'Glossary', Icon: BookOpen },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const brand = useMemo(() => getBrand(), []);

  return (
    <div className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col p-4">
      <div className="flex items-center gap-2.5 h-14 border-b border-slate-800 shrink-0 mb-6">
        {brand.logo === 'image' && brand.logoSrc ? (
          <img alt={`${brand.name} Logo`} className="w-8 h-8 object-contain" src={brand.logoSrc} />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Zap size={16} className="text-cyan-400" />
          </div>
        )}
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight leading-none" style={{ color: brand.color }}>{brand.name}</span>
          <span className="text-[9px] text-slate-500 font-semibold tracking-wider mt-0.5 uppercase">{brand.subtitle}</span>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activePage === id
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      <div className="mt-auto pt-4 border-t border-slate-700">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
    </div>
  );
}
