/**
 * Incidents.tsx
 *
 * System Health & Recovery Dashboard.
 * Displays "Health Pulses" for critical infrastructure components and
 * the Self-Recovery IncidentLog from the stream-monitor.
 */

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Database, Server, Cpu, CheckCircle } from 'lucide-react';

interface Incident {
  id: string;
  streamId: string;
  timestamp: string;
  error: string;
  recoveryStatus: 'success' | 'failed' | 'in-progress';
}

export const IncidentsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [redisHealth, setRedisHealth] = useState('healthy');
  const [pgHealth, setPgHealth] = useState('healthy');

  useEffect(() => {
    // Generate mock incidents to display the Stream Monitor Recovery logs
    setIncidents([
      {
        id: 'inc_1039',
        streamId: 'STREAM_AUTUMN_001',
        timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        error: 'CRITICAL: Bitrate dropped to 0 kbps. Media feed lost.',
        recoveryStatus: 'success'
      },
      {
        id: 'inc_1038',
        streamId: 'STREAM_DEV_TEST',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        error: 'OBS Socket disconnected unexpectedly.',
        recoveryStatus: 'success'
      }
    ]);
  }, []);

  return (
    <div className="min-h-screen bg-black text-gray-200 p-8 font-sans">
      
      <header className="mb-10 flex items-center gap-4">
        <ShieldAlert size={32} className="text-red-500" />
        <h1 className="text-3xl font-bold tracking-widest text-white">INCIDENT RESPONSE <span className="text-gray-500 font-light">& RECOVERY</span></h1>
      </header>

      {/* HEALTH PULSE CLUSTER */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        
        {/* PostgreSQL Pool */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-400 font-semibold tracking-wider flex items-center gap-2"><Database size={18}/> Postgres Pool</h3>
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pgHealth === 'healthy' ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${pgHealth === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
          </div>
          <div className="text-xl font-bold text-white">200/200 <span className="text-xs text-gray-500 font-normal">MAX_CONNECTIONS</span></div>
          <p className="text-sm text-green-400 mt-2">WAL Checksums Active</p>
        </div>

        {/* Redis Cluster */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-400 font-semibold tracking-wider flex items-center gap-2"><Server size={18}/> Redis Streams</h3>
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${redisHealth === 'healthy' ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${redisHealth === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
          </div>
          <div className="text-xl font-bold text-white">Master/Replica <span className="text-xs text-gray-500 font-normal">SYNCED</span></div>
          <p className="text-sm text-green-400 mt-2">Buffer MAXLEN: 100K</p>
        </div>

        {/* Lead Processor Node */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-gray-400 font-semibold tracking-wider flex items-center gap-2"><Cpu size={18}/> Processor Daemon</h3>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
          </div>
          <div className="text-xl font-bold text-white">0% <span className="text-xs text-gray-500 font-normal">DLQ BACKLOG</span></div>
          <p className="text-sm text-green-400 mt-2">Batches inserting normally</p>
        </div>
      </section>

      {/* INCIDENT LOG TABLE */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-800 bg-gray-950/50 flex justify-between items-center">
          <h2 className="font-semibold text-white tracking-widest text-sm uppercase">Self-Recovery Event Log</h2>
          <span className="text-xs font-mono text-gray-500">Auto-generated by @xhi/stream-monitor</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900/80 font-mono text-xs uppercase text-gray-500">
              <tr>
                <th className="p-4">Incident ID</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Target Stream</th>
                <th className="p-4 w-1/3">Error Detection</th>
                <th className="p-4 text-center">Resolution Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {incidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-mono font-bold text-white">{incident.id}</td>
                  <td className="p-4 text-gray-500 font-mono">{new Date(incident.timestamp).toLocaleString()}</td>
                  <td className="p-4 text-blue-400 uppercase tracking-wider">{incident.streamId}</td>
                  <td className="p-4 text-red-400">{incident.error}</td>
                  <td className="p-4 text-center">
                    {incident.recoveryStatus === 'success' && (
                      <span className="inline-flex items-center gap-2 font-mono text-xs text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                        <CheckCircle size={14} /> AUTORECOVERED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
};
