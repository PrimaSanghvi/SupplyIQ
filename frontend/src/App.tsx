import { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import NetworkPage from './pages/NetworkPage';
import ScenariosPage from './pages/ScenariosPage';
import OptimizerPage from './pages/OptimizerPage';
import ChatPage from './pages/ChatPage';
import MovementLedgerPage from './pages/MovementLedgerPage';
import SimulationPage from './pages/SimulationPage';
import RiskInsightsPage from './pages/RiskInsightsPage';
import DashboardPage from './pages/DashboardPage';
import GlossaryPage from './pages/GlossaryPage';

type Page = 'dashboard' | 'network' | 'scenarios' | 'optimizer' | 'movements' | 'simulation' | 'risk' | 'chat' | 'glossary';

function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="flex-1 overflow-auto p-6">
        {activePage === 'dashboard' && <DashboardPage />}
        {activePage === 'network' && <NetworkPage />}
        {activePage === 'scenarios' && <ScenariosPage />}
        {activePage === 'optimizer' && <OptimizerPage />}
        {activePage === 'movements' && <MovementLedgerPage />}
        {activePage === 'simulation' && <SimulationPage />}
        {activePage === 'risk' && <RiskInsightsPage />}
        {activePage === 'chat' && <ChatPage />}
        {activePage === 'glossary' && <GlossaryPage />}
      </main>
    </div>
  );
}

export default App;
