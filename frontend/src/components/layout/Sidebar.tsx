import { Network, GitCompare, Sliders, ArrowRightLeft, Activity, ShieldAlert, MessageCircle, Zap } from 'lucide-react';

type Page = 'network' | 'scenarios' | 'optimizer' | 'movements' | 'simulation' | 'risk' | 'chat';

const NAV_ITEMS: { id: Page; label: string; Icon: typeof Network }[] = [
  { id: 'network', label: 'Network', Icon: Network },
  { id: 'scenarios', label: 'Scenarios', Icon: GitCompare },
  { id: 'optimizer', label: 'Optimizer', Icon: Sliders },
  { id: 'movements', label: 'Movements', Icon: ArrowRightLeft },
  { id: 'simulation', label: 'Simulation', Icon: Activity },
  { id: 'risk', label: 'Risk Insights', Icon: ShieldAlert },
  { id: 'chat', label: 'Explainer', Icon: MessageCircle },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <div className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col p-4">
      <div className="flex items-center gap-2.5 h-16 border-b border-slate-800 shrink-0 mb-6">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Zap size={16} className="text-cyan-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight leading-none text-white">SupplyMind AI</span>
          <span className="text-[9px] text-slate-500 font-semibold tracking-wider mt-0.5 uppercase">Optimization Engine</span>
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
    </div>
  );
}
