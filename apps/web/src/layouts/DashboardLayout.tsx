/**
 * Speckit UI: XHI Mission-Control Dashboard Layout
 *
 * Provides a stateless architecture, utilizing Tailwind CSS for all styling.
 * Everything is fetched/mutated via Socket.io and API layers.
 */

import React, { useState, useEffect } from 'react';
import { 
  Menu, X, Activity, PlayCircle, PlusSquare, Link,
  Phone, AlertTriangle, ShieldCheck, HelpCircle
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// ═══════════════════════════════════════════════════════════════════════════
// Types (Mock structures matching DB models and Socket responses)
// ═══════════════════════════════════════════════════════════════════════════

interface LiveSession {
  id: string;
  title: string;
  activeViewers: number;
  leadsCollected: number;
  budgetPct: number;
  status: 'active' | 'paused';
}

interface SocketLeadPayload {
  id: string;
  phoneNumber: string;
  platform: string;
  confidenceScore: number;
  sessionId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════════════════════

export const DashboardLayout: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  
  // Real-time State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeLives, setActiveLives] = useState<LiveSession[]>([]);
  const [leadTicker, setLeadTicker] = useState<SocketLeadPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Connection & Sync
  useEffect(() => {
    // Attempting connection with API Gateway Redis/Socket Adapter
    const s = io(import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000');
    setSocket(s);

    s.on('connect', () => {
      // Typically fetch existing active lives/leads state from API immediately here:
      simulateApiFetch();
    });

    // Handle high-speed incoming leads
    s.on('leads:live_update', (data: { leads: SocketLeadPayload[], batchId: string }) => {
      setLeadTicker(prev => [...data.leads, ...prev].slice(0, 50)); // Keep max 50 in view
    });

    return () => { s.disconnect(); };
  }, []);

  // Simulating API loading state to show Skeletons
  const simulateApiFetch = () => {
    setIsLoading(true);
    setTimeout(() => {
      setActiveLives([
        { id: 'sess_1', title: 'Summer Drop TikTok', activeViewers: 3410, leadsCollected: 140, budgetPct: 65, status: 'active' },
        { id: 'sess_2', title: 'Insta Q&A', activeViewers: 950, leadsCollected: 34, budgetPct: 10, status: 'paused' }
      ]);
      setLeadTicker([]);
      setIsLoading(false);
    }, 1500);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Render Helpers
  // ════════════════════════════════════════════════════════════════════════

  // Skeletons
  const renderCardSkeleton = () => (
    <div className="min-w-[280px] h-32 bg-gray-800 rounded-xl animate-pulse flex flex-col justify-between p-4">
      <div className="h-4 bg-gray-700 w-1/2 rounded" />
      <div className="h-8 bg-gray-700 w-3/4 rounded mt-4" />
    </div>
  );

  const renderTickerSkeleton = () => (
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse border-b border-gray-800">
        <td className="p-3"><div className="h-4 bg-gray-700 w-16 rounded" /></td>
        <td className="p-3"><div className="h-4 bg-gray-700 w-32 rounded" /></td>
        <td className="p-3"><div className="h-4 justify-self-end bg-gray-700 w-12 rounded" /></td>
        <td className="p-3"><div className="h-4 bg-gray-700 w-8 rounded" /></td>
      </tr>
    ))
  );

  // Views
  const LiveCard = ({ live }: { live: LiveSession }) => (
    <div 
      className="min-w-[280px] shrink-0 bg-gray-900 border border-gray-800 hover:border-blue-500/50 transition-colors p-4 rounded-xl cursor-pointer shadow-lg"
      /* Drill-down action */
      onClick={() => window.location.href = `/live/${live.id}`} 
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-white font-semibold truncate pr-2">{live.title}</h3>
        {/* Pulse indicator */}
        <div className="flex items-center space-x-2">
          {live.status === 'active' && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm mt-4">
        <div>
          <span className="text-gray-400 text-xs uppercase block">Viewers</span>
          <span className="text-gray-100 font-mono text-lg">{live.activeViewers.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-400 text-xs uppercase block">Leads</span>
          <span className="text-blue-400 font-mono text-lg">{live.leadsCollected}</span>
        </div>
      </div>
      
      {/* Budget Bar */}
      <div className="mt-4 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div 
          className="bg-purple-500 h-1.5 transition-all duration-500" 
          style={{ width: `${live.budgetPct}%` }} 
        />
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  // Structural Layout 
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-screen w-full bg-black flex overflow-hidden font-sans text-gray-200">
      
      {/* LEFT SIDEBAR (Collapsible) */}
      <aside className={`
        ${isSidebarOpen ? 'w-64' : 'w-20'} 
        bg-gray-900 border-r border-gray-800 transition-all duration-300 flex flex-col relative
      `}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-800">
          {isSidebarOpen && <span className="font-bold tracking-widest text-white text-lg">XHI<span className="text-blue-500">NET</span></span>}
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-800 rounded text-gray-400 transition-colors">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {/* Navigation Items */}
          {[
            { id: 1, name: 'Mission Control', icon: Activity, active: true },
            { id: 2, name: 'Active Sessions', icon: PlayCircle },
            { id: 3, name: 'Global Leads', icon: Phone },
          ].map(item => (
            <div key={item.id} className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer ${item.active ? 'bg-blue-600/10 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800 transition-colors'}`}>
              <item.icon size={20} className="shrink-0" />
              {isSidebarOpen && <span className="font-medium whitespace-nowrap">{item.name}</span>}
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* TOP BAR: Active Lives Widget (Horizontal Scroll) */}
        <header className="h-48 border-b border-gray-800 bg-gray-950/50 p-6 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Live Ad Sessions</h2>
          <div className="flex-1 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {isLoading 
              ? [...Array(4)].map((_, i) => <React.Fragment key={i}>{renderCardSkeleton()}</React.Fragment>)
              : activeLives.map(live => <LiveCard key={live.id} live={live} />)
            }
          </div>
        </header>

        {/* SPLIT SCREEN VIEW */}
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
          
          {/* TOP HALF: Quick Start Widgets */}
          <section className="h-32 shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl flex items-center justify-center space-x-3 text-white transition-all shadow-lg hover:-translate-y-0.5">
              <PlusSquare size={22} />
              <span className="font-bold">Launch Live</span>
            </button>
            
            <button className="bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl flex items-center justify-center space-x-3 text-gray-200 transition-all shadow hover:-translate-y-0.5">
              <Link size={20} />
              <span className="font-bold text-sm">Sync Ads Manager</span>
            </button>
          </section>

          {/* BOTTOM HALF: The Lead Ticker (High-Speed Table) */}
          <section className="flex-1 bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-800 bg-gray-900/80 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Activity size={18} className="text-green-400" />
                <h3 className="font-semibold text-white">Live Lead Stream</h3>
              </div>
              <span className="text-xs font-mono text-gray-500">Connected to Redis Cluster</span>
            </div>
            
            <div className="flex-1 overflow-auto bg-black/20">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="text-xs uppercase bg-gray-900/50 text-gray-500 sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="font-medium p-4">Platform</th>
                    <th className="font-medium p-4">Extracted Phone</th>
                    <th className="font-medium p-4">Confidence</th>
                    <th className="font-medium p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50 font-mono">
                  {isLoading ? renderTickerSkeleton() : leadTicker.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-600">Waiting for live stream extractions...</td>
                    </tr>
                  ) : (
                    leadTicker.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-800/50 transition-colors animate-pulse-once">
                        <td className="p-4 uppercase text-xs tracking-wider">{lead.platform}</td>
                        <td className="p-4 text-gray-200">{lead.phoneNumber}</td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${lead.confidenceScore > 0.8 ? 'bg-green-500' : lead.confidenceScore > 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${lead.confidenceScore * 100}%` }}
                              />
                            </div>
                            <span>{(lead.confidenceScore * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {lead.confidenceScore > 0.8 ? <ShieldCheck className="mx-auto text-green-400" size={16}/> : <AlertTriangle className="mx-auto text-yellow-500" size={16} />}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </main>
      
    </div>
  );
};
