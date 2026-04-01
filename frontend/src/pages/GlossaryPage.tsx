import { useState, useEffect, useMemo } from 'react';
import { Search, Info } from 'lucide-react';
import { fetchGlossary } from '../api/network';
import type { GlossaryEntry } from '../types/optimization';

export default function GlossaryPage() {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchGlossary()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => Array.from(new Set(entries.map((e) => e.category))), [entries]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        search === '' ||
        entry.term.toLowerCase().includes(search.toLowerCase()) ||
        entry.definition.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [entries, search, selectedCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full mr-3" />
        Loading glossary...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Glossary</h1>
            <div className="group relative">
              <button className="w-4 h-4 rounded-full bg-slate-700 text-slate-400 text-[9px] flex items-center justify-center hover:bg-slate-600 cursor-help">?</button>
              <div className="absolute bottom-6 left-0 hidden group-hover:block bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 w-80 z-10">
                This glossary explains every term, metric, and concept used in the SupplyMind AI platform. Use the search bar and category filters to find specific entries.
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Complete reference guide for all metrics, formulas, and optimization concepts
          </p>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full animate-pulse">
          LIVE
        </span>
      </div>

      {/* Search + Category Filter */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            placeholder="Search terms and definitions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 h-9 text-sm bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div className="grid gap-3">
        {filtered.map((entry) => (
          <div
            key={entry.term}
            className="bg-slate-900 rounded-xl border border-slate-700 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-white">{entry.term}</h3>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                    {entry.category}
                  </span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{entry.definition}</p>
              </div>
              {entry.formula && (
                <code className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-md whitespace-nowrap">
                  {entry.formula}
                </code>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-500">
            No glossary entries match your search.
          </div>
        )}
      </div>
    </div>
  );
}
