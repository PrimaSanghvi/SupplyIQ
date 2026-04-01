import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity, DollarSign, Leaf, ShieldAlert, Package, Truck, TrendingUp, TrendingDown,
  AlertTriangle, Warehouse, CircleDollarSign, Boxes, BarChart3, CloudSnow, Ship, CheckCircle2
} from 'lucide-react';
import { fetchNetwork } from '../api/network';
import { runOptimization } from '../api/optimize';
import WeightSliders from '../components/optimizer/WeightSliders';
import type { DC, Lane } from '../types/network';
import type { OptimizationResult, Weights } from '../types/optimization';

// ─── Risk Events (same as RiskInsightsPage) ───

interface RiskEvent {
  id: string;
  dcId: string;
  type: 'stockout' | 'weather' | 'demand_surge' | 'port_delay';
  probability: number;
  penaltyCost: number;
  description: string;
}

const RISK_EVENTS: RiskEvent[] = [
  { id: 'risk-chi', dcId: 'DC-CHI', type: 'stockout', probability: 0.95, penaltyCost: 15000, description: 'Chicago DC imminent stockout — supply/demand ratio 0.37' },
  { id: 'risk-sea', dcId: 'DC-SEA', type: 'weather', probability: 0.70, penaltyCost: 12000, description: 'Winter storm risk — 3-5 day transit disruption to Seattle' },
  { id: 'risk-nyc', dcId: 'DC-NYC', type: 'demand_surge', probability: 0.45, penaltyCost: 8000, description: 'Holiday demand surge in Northeast corridor (+25%)' },
  { id: 'risk-lax', dcId: 'DC-LAX', type: 'port_delay', probability: 0.30, penaltyCost: 5000, description: 'Long Beach port congestion — 2-day inbound delays' },
];

const riskTypeIcon: Record<string, typeof AlertTriangle> = {
  stockout: Package,
  weather: CloudSnow,
  demand_surge: BarChart3,
  port_delay: Ship,
};

// ─── Component ───

export default function DashboardPage() {
  const [weights, setWeights] = useState<Weights>({ cost: 0.5, carbon: 0.3, service_risk: 0.2 });
  const [dcs, setDcs] = useState<DC[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [naiveResult, setNaiveResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetwork().then((data) => {
      setDcs(data.dcs);
      setLanes(data.lanes);
    });
    // Naive solution for delta comparison
    runOptimization({ cost: 1, carbon: 0, service_risk: 0 }).then(setNaiveResult);
  }, []);

  const optimize = useCallback((w: Weights) => {
    setLoading(true);
    runOptimization(w).then((r) => {
      setResult(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Debounced optimize on weight change
  useEffect(() => {
    const timer = setTimeout(() => optimize(weights), 300);
    return () => clearTimeout(timer);
  }, [weights, optimize]);

  // Computed metrics
  const totalRiskExposure = RISK_EVENTS.reduce((s, r) => s + r.probability * r.penaltyCost, 0);

  const avgUtilization = useMemo(() => {
    if (!result) return 0;
    return result.dc_states_after.reduce((s, dc) => s + dc.utilization_pct, 0) / result.dc_states_after.length;
  }, [result]);

  const totalUnitsMoved = useMemo(() => {
    if (!result) return 0;
    return result.transfers.reduce((s, t) => s + t.units, 0);
  }, [result]);

  const netSavings = useMemo(() => {
    if (!result || !naiveResult) return 0;
    return naiveResult.objective_value - result.objective_value;
  }, [result, naiveResult]);

  const activeLanes = useMemo(() => {
    if (!result) return { used: 0, total: lanes.length };
    const usedSet = new Set(result.transfers.map((t) => `${t.origin}-${t.destination}`));
    return { used: usedSet.size, total: lanes.length };
  }, [result, lanes]);

  // Transport mode split
  const modeSplit = useMemo(() => {
    if (!result || lanes.length === 0) return { truck: 0, rail: 0, intermodal: 0 };
    const laneMap: Record<string, string> = {};
    lanes.forEach((l) => { laneMap[`${l.origin}-${l.destination}`] = (l as Lane & { mode?: string }).mode || 'truck'; });

    const counts = { truck: 0, rail: 0, intermodal: 0 };
    result.transfers.forEach((t) => {
      const mode = laneMap[`${t.origin}-${t.destination}`] || 'truck';
      counts[mode as keyof typeof counts] += t.units;
    });
    return counts;
  }, [result, lanes]);

  const modeSplitTotal = modeSplit.truck + modeSplit.rail + modeSplit.intermodal;

  // Delta helper
  const delta = (current: number, naive: number) => {
    const diff = current - naive;
    if (Math.abs(diff) < 0.5) return null;
    return { value: diff, type: diff < 0 ? 'positive' : 'negative' } as const;
  };

  const fmt = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (!result) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full mr-3" />
        Loading dashboard...
      </div>
    );
  }

  const cb = result.cost_breakdown;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Command Center</h1>
            <div className="group relative">
              <button className="w-4 h-4 rounded-full bg-slate-700 text-slate-400 text-[9px] flex items-center justify-center hover:bg-slate-600 cursor-help">?</button>
              <div className="absolute bottom-6 left-0 hidden group-hover:block bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 w-80 z-10">
                This dashboard shows a summary of the current optimization run. Adjust the strategic weights below to see how the optimizer re-balances cost, carbon, and resilience trade-offs in real time.
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time multi-objective optimization overview with key performance indicators
          </p>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full animate-pulse">
          LIVE
        </span>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard icon={<Activity size={14} />} label="Objective Z" value={fmt(result.objective_value)} color="text-cyan-400"
          delta={naiveResult ? delta(result.objective_value, naiveResult.objective_value) : null} />
        <KPICard icon={<DollarSign size={14} />} label="Transport Cost" value={fmt(cb.transport)} color="text-amber-400"
          delta={naiveResult ? delta(cb.transport, naiveResult.cost_breakdown.transport) : null} />
        <KPICard icon={<Warehouse size={14} />} label="Holding Cost" value={fmt(cb.holding)} color="text-slate-300" />
        <KPICard icon={<CircleDollarSign size={14} />} label="Stockout Penalty" value={fmt(cb.stockout_penalty)} color="text-red-400" />
        <KPICard icon={<Leaf size={14} />} label="CO₂ Footprint" value={`${(result.total_carbon_kg / 1000).toFixed(1)}t`} color="text-emerald-400"
          delta={naiveResult ? delta(result.total_carbon_kg, naiveResult.total_carbon_kg) : null} />
        <KPICard icon={<ShieldAlert size={14} />} label="Risk Exposure" value={fmt(totalRiskExposure)} color="text-amber-400" />
        <KPICard icon={<Boxes size={14} />} label="Movements" value={`${result.transfers.length}`} color="text-cyan-400" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-3.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Avg. DC Utilization</p>
          <p className={`text-xl font-semibold font-mono tracking-tight ${avgUtilization > 85 ? 'text-red-400' : avgUtilization > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {avgUtilization.toFixed(0)}%
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-3.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Total Units Moved</p>
          <p className="text-xl font-semibold font-mono tracking-tight text-cyan-400">{totalUnitsMoved.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-3.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Net Cost Savings</p>
          <p className={`text-xl font-semibold font-mono tracking-tight ${netSavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${Math.abs(netSavings).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className={`text-[10px] mt-1 ${netSavings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {netSavings >= 0 ? 'optimized is cheaper' : 'risk premium'}
          </p>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-3.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Active Lanes</p>
          <p className="text-xl font-semibold font-mono tracking-tight text-amber-400">{activeLanes.used} / {activeLanes.total}</p>
        </div>
      </div>

      {/* Strategy Panel: Sliders + Mode Split + Cost Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weight Sliders */}
        <div>
          <WeightSliders weights={weights} onChange={setWeights} />
        </div>

        {/* Transport Mode Split */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">Transport Mode Split</h4>
          {modeSplitTotal > 0 ? (
            <div className="space-y-3">
              {([
                { mode: 'truck', label: 'Truck', color: 'bg-cyan-500', icon: <Truck size={12} /> },
                { mode: 'rail', label: 'Rail', color: 'bg-slate-400', icon: <Activity size={12} /> },
                { mode: 'intermodal', label: 'Intermodal', color: 'bg-teal-500', icon: <Boxes size={12} /> },
              ] as const).map(({ mode, label, color, icon }) => {
                const units = modeSplit[mode];
                const pct = (units / modeSplitTotal) * 100;
                return (
                  <div key={mode}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-200">{icon} {label}</span>
                      <span className="text-xs font-mono text-slate-400">{units.toLocaleString()} units ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No transfers to display</p>
          )}
        </div>

        {/* Cost Composition */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">Cost Composition</h4>
          {(() => {
            const total = cb.transport + cb.holding + cb.stockout_penalty + cb.overflow_penalty;
            if (total === 0) return <p className="text-xs text-slate-500 italic">No costs to display</p>;
            const items = [
              { label: 'Transport', value: cb.transport, color: 'bg-cyan-500' },
              { label: 'Holding', value: cb.holding, color: 'bg-slate-400' },
              { label: 'Stockout', value: cb.stockout_penalty, color: 'bg-red-500' },
              { label: 'Overflow', value: cb.overflow_penalty, color: 'bg-amber-500' },
            ].filter((i) => i.value > 0);
            return (
              <div className="space-y-3">
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-200">{item.label}</span>
                        <span className="text-xs font-mono text-slate-400">{fmt(item.value)} ({((item.value / total) * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.color} transition-all duration-500`} style={{ width: `${(item.value / total) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between">
                  <span className="text-sm font-semibold text-slate-300">Total</span>
                  <span className="text-sm font-mono font-semibold text-white">{fmt(total)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* DC Health Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">Distribution Center Health</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['DC', 'Inventory', 'Capacity', 'Util %', 'Demand', 'Safety Stock', 'Coverage', 'Holding $/u', 'Risk'].map((h) => (
                  <th key={h} className="text-left text-slate-400 text-xs uppercase tracking-wide py-2 px-2 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dcs.map((dc) => {
                const state = result.dc_states_after.find((s) => s.id === dc.id);
                const stock = state?.stock_after ?? dc.current_stock;
                const utilPct = state?.utilization_pct ?? (dc.current_stock / dc.capacity * 100);
                const dailyDemand = dc.demand_forecast / 30;
                const coverage = dailyDemand > 0 ? stock / dailyDemand : 999;
                const ratio = dc.current_stock / dc.demand_forecast;
                const riskLevel = ratio < 0.5 ? 'HIGH' : ratio < 1.0 ? 'MEDIUM' : 'LOW';
                const riskColor = riskLevel === 'HIGH' ? 'text-red-400 bg-red-500/20 border-red-500/30' : riskLevel === 'MEDIUM' ? 'text-amber-400 bg-amber-500/20 border-amber-500/30' : 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';

                return (
                  <tr key={dc.id} className="border-b border-slate-800">
                    <td className="py-2 px-2 text-xs font-medium text-white">{dc.name}</td>
                    <td className="py-2 px-2 text-xs font-mono text-slate-300">{stock.toLocaleString()}</td>
                    <td className="py-2 px-2 text-xs font-mono text-slate-400">{dc.capacity.toLocaleString()}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs font-mono ${utilPct > 90 ? 'text-red-400' : utilPct > 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {utilPct.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs font-mono text-slate-300">{dc.demand_forecast.toLocaleString()}</td>
                    <td className="py-2 px-2 text-xs font-mono text-slate-400">{dc.safety_stock.toLocaleString()}</td>
                    <td className="py-2 px-2">
                      <span className={`text-xs font-mono ${coverage < 7 ? 'text-red-400' : coverage < 14 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {coverage.toFixed(1)}d
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs font-mono text-slate-400">${dc.holding_cost_per_unit}</td>
                    <td className="py-2.5 px-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold ${riskColor}`}>{riskLevel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Risk Events */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">Active Risk Events</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RISK_EVENTS.map((risk) => {
            const Icon = riskTypeIcon[risk.type];
            const isHigh = risk.probability > 0.6;
            return (
              <div key={risk.id} className={`rounded-lg border p-3 ${isHigh ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700 bg-slate-800/30'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={14} className={isHigh ? 'text-red-400' : 'text-amber-400'} />
                  <span className="text-xs font-semibold text-white">{risk.dcId.replace('DC-', '')} — {risk.type.replace('_', ' ')}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ml-auto ${isHigh ? 'text-red-400 border-red-500/40 bg-red-500/20' : 'text-amber-400 border-amber-500/40 bg-amber-500/20'}`}>
                    {(risk.probability * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">{risk.description}</p>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-slate-500">
                  <span>Penalty: <strong className="text-slate-300">${risk.penaltyCost.toLocaleString()}</strong></span>
                  <span>Exposure: <strong className="text-slate-300">${(risk.probability * risk.penaltyCost).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card Component ───

function KPICard({ icon, label, value, color, delta }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  delta?: { value: number; type: 'positive' | 'negative' } | null;
}) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest leading-none">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className={`text-xl font-semibold font-mono tracking-tight leading-tight ${color}`}>{value}</p>
      {delta && (
        <div className={`flex items-center gap-1 text-[10px] mt-1 ${delta.type === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>
          {delta.type === 'positive' ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
          <span>
            {delta.value < 0 ? '-' : '+'}${Math.abs(delta.value).toLocaleString(undefined, { maximumFractionDigits: 0 })} vs naive
          </span>
        </div>
      )}
    </div>
  );
}
