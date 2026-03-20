/**
 * LiveDetails.tsx
 *
 * Drill-Down View for granular single-session analytics and control.
 * Features:
 *  - Plotly.js rendered graphs combining Ad Spend Velocity vs Lead Accumulation.
 *  - Isolated WebSocket stream ticker filtered purely for `sessionId`.
 *  - FAB (Floating Action Button) for instant Quick Start / Sync actions.
 */

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { PlayCircle, Link, Activity, Phone, ShieldCheck, AlertTriangle, ArrowLeft } from 'lucide-react';
import Plot from 'react-plotly.js';

interface SocketLeadPayload {
  id: string;
  phoneNumber: string;
  platform: string;
  confidenceScore: number;
  sessionId: string;
}

export const LiveDetails: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionLeads, setSessionLeads] = useState<SocketLeadPayload[]>([]);
  
  // Real-time metrics
  const [cpl, setCpl] = useState(0);
  const [spend, setSpend] = useState(0);

  // Connection
  useEffect(() => {
    const s = io(import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3000');
    
    // Simulating API loading state on component mount
    setTimeout(() => setIsLoading(false), 1200);

    // Initial state simulation (e.g. from /api/sessions/:id)
    setCpl(1.24);
    setSpend(320);

    s.on('leads:live_update', (data: { leads: SocketLeadPayload[] }) => {
      // 1. WebSocket isolation requirement 
      // Filter the ticker so we only see leads created inside THIS specific live
      const incomingForThisSession = data.leads.filter(l => l.sessionId === sessionId);
      
      if (incomingForThisSession.length > 0) {
        setSessionLeads(prev => [...incomingForThisSession, ...prev].slice(0, 100)); // Keep max 100
        
        // Mock update metrics based on simulated payload rates
        setSpend(prev => prev + (incomingForThisSession.length * 1.5)); // Burn simulation
      }
    });

    return () => { s.disconnect(); };
  }, [sessionId]);

  // Recalculate dynamic tracking variable 
  useEffect(() => {
    if (sessionLeads.length > 0) {
      setCpl(spend / (sessionLeads.length + 258)); // 258 base simulation leads
    }
  }, [spend, sessionLeads.length]);

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col font-sans p-6 overflow-hidden">
      
      {/* HEADER */}
      <header className="flex items-center justify-between mb-6 pb-6 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400" onClick={() => window.history.back()}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3">
              LIVE DIAGNOSTICS: <span className="text-blue-500">{sessionId.toUpperCase()}</span>
              {/* Pulse indicator */}
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </h1>
            <p className="text-gray-500 font-mono text-sm mt-1">Cost Per Lead (CPL): ${cpl.toFixed(2)} | Current Spend: ${spend.toFixed(2)}</p>
          </div>
        </div>
      </header>

      {/* SPLIT LAYOUT */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        
        {/* TOP HALF: 100% Width Plotly JS Analytics */}
        {isLoading ? (
          <div className="h-64 bg-gray-900 border border-gray-800 rounded-xl animate-pulse p-6">
            <div className="w-1/4 h-4 bg-gray-800 rounded mb-4"/>
            <div className="w-full h-full bg-gray-800/50 rounded" />
          </div>
        ) : (
          <section className="h-64 shrink-0 bg-gray-900 rounded-xl border border-gray-800 shadow-xl overflow-hidden">
            <Plot
              className="w-full h-full"
              data={[
                {
                  x: sessionLeads.length > 0 ? sessionLeads.map((_, i) => i) : [1, 2, 3, 4],
                  y: sessionLeads.length > 0 ? sessionLeads.map((_, i) => spend - (i * 1.5)) : [100, 150, 200, 320],
                  type: 'scatter',
                  mode: 'lines',
                  marker: { color: 'rgb(147, 51, 234)' },
                  line: { shape: 'spline', width: 3 },
                  fill: 'tozeroy',
                  fillcolor: 'rgba(147, 51, 234, 0.2)',
                  name: 'Budget Burn Velocity',
                },
                {
                  x: sessionLeads.length > 0 ? sessionLeads.map((_, i) => i) : [1, 2, 3, 4],
                  y: sessionLeads.length > 0 ? sessionLeads.map((_, i) => sessionLeads.length - i + 258) : [50, 90, 150, 258],
                  type: 'bar',
                  marker: { color: 'rgb(59, 130, 246)' },
                  name: 'Leads Acquired',
                }
              ]}
              layout={{
                autosize: true,
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                margin: { l: 40, r: 20, t: 30, b: 30 },
                xaxis: { showgrid: false, color: '#4b5563' },
                yaxis: { showgrid: true, gridcolor: '#1f2937', color: '#4b5563' },
                legend: { orientation: 'h', y: 1.2, font: { color: '#9ca3af' } },
                font: { family: 'ui-sans-serif, system-ui' }
              }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </section>
        )}

        {/* BOTTOM HALF: Isolated Web-Socket Ticker */}
        <section className="flex-1 bg-gray-900 border border-gray-800 rounded-xl flex flex-col overflow-hidden relative">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Phone size={18} className="text-blue-500" /> Isolated Lead Stream
            </h3>
          </div>
          <div className="flex-1 overflow-auto bg-black/20 pb-20">
            <table className="w-full text-left text-sm text-gray-400 font-mono">
              <thead className="bg-gray-900/80 sticky top-0 backdrop-blur-md z-10">
                <tr>
                  <th className="p-4 font-medium">Capture Time</th>
                  <th className="p-4 font-medium text-white">Extracted Phone</th>
                  <th className="p-4 font-medium uppercase text-xs">Platform</th>
                  <th className="p-4 font-medium text-center">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  Array.from({length: 4}).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="p-4"><div className="h-4 bg-gray-800 w-16 rounded"/></td>
                      <td className="p-4"><div className="h-4 bg-blue-900/30 w-32 rounded"/></td>
                      <td className="p-4"><div className="h-4 bg-gray-800 w-8 rounded"/></td>
                      <td className="p-4"><div className="h-4 bg-gray-800 w-12 rounded mx-auto"/></td>
                    </tr>
                  ))
                ) : sessionLeads.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-600 font-sans">No leads detected in the current buffer view.</td></tr>
                ) : (
                  sessionLeads.map((lead, idx) => (
                    <tr key={`${lead.id}-${idx}`} className="hover:bg-gray-800/80 transition-colors animate-pulse-once">
                      <td className="p-4 text-xs text-gray-500">{new Date().toLocaleTimeString()}</td>
                      <td className="p-4 text-blue-400 font-bold">{lead.phoneNumber}</td>
                      <td className="p-4 uppercase">{lead.platform}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {lead.confidenceScore > 0.8 ? <ShieldCheck className="text-green-500" size={16}/> : <AlertTriangle className="text-yellow-500" size={16} />}
                          <span className={lead.confidenceScore > 0.8 ? 'text-green-500' : 'text-yellow-500'}>
                             {(lead.confidenceScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>

      {/* FLOATING ACTION BUTTON (FAB) PANEL: Quick Start / Sync Ads */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end gap-3 z-50">
         <button className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white p-3 pr-4 rounded-full shadow-2xl transition-all transform hover:-translate-y-1">
           <div className="bg-gray-700 p-2 rounded-full"><Link size={18} /></div>
           <span className="font-semibold text-sm">Force Sync Ads</span>
         </button>
         
         <button className="flex items-center gap-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white p-3 pr-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform hover:-translate-y-1 hover:scale-105 group">
           <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition-colors"><PlayCircle size={24} /></div>
           <span className="font-bold text-lg tracking-wide shrink-0">QUICK RECOVER</span>
         </button>
      </div>

    </div>
  );
};
