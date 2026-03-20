import React, { useState, useEffect } from 'react';
import { DownloadCloud, Table, FileText, File as PdfIcon, Clock, HardDrive } from 'lucide-react';

interface PastSession {
  id: string;
  title: string;
  date: string;
  leads: number;
}

export const LiveHistory: React.FC = () => {
  const [sessions, setSessions] = useState<PastSession[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    // Mock fetch GET /api/sessions/history
    setSessions([
      { id: '111_autumn_promo', title: 'Autumn Collection Launch', date: '2026-03-18', leads: 4210 },
      { id: '222_flash_sale', title: 'Weekend TikTok Flash Sale', date: '2026-03-15', leads: 15302 } // Heavy session 
    ]);
  }, []);

  const handleDownload = (sessionId: string, format: 'csv' | 'pdf' | 'gsheet') => {
    setActiveDropdown(null);
    const apiUrl = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:3004'; // pointing to new export service port
    
    // Redirect trigger to API endpoint handling streaming logic
    if (format === 'gsheet') {
      // Async POST request, returning alert
      fetch(`${apiUrl}/api/export?id=${sessionId}&format=gsheet`, { method: 'GET' })
        .then(res => res.json())
        .then(data => alert(`Sync Complete: ${data.success ? 'Data' : 'Failed'} synchronized to Google Sheets!`))
        .catch(err => alert('Failed Google Sync: ' + err.message));
    } else {
      // Direct browser File download
      window.location.href = `${apiUrl}/api/export?id=${sessionId}&format=${format}`;
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 p-8 font-sans">
      <header className="mb-10 flex items-center gap-4 border-b border-gray-800 pb-6">
        <Clock size={32} className="text-purple-500" />
        <h1 className="text-3xl font-bold tracking-widest text-white">LIVE <span className="text-gray-500 font-light">HISTORY</span></h1>
      </header>

      <div className="overflow-hidden bg-gray-900 border border-gray-800 rounded-xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-white tracking-widest flex items-center gap-2">
              <HardDrive size={18} className="text-gray-400"/> Archival Storage
            </h3>
        </div>

        <table className="w-full text-left font-mono text-sm text-gray-400">
          <thead className="bg-gray-950/80 uppercase text-gray-500 font-sans text-xs">
            <tr>
              <th className="p-4">Session Title</th>
              <th className="p-4">Date</th>
              <th className="p-4">Total Leads</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sessions.map(session => (
              <tr key={session.id} className="hover:bg-gray-800/50">
                <td className="p-4 font-bold text-white font-sans">{session.title}</td>
                <td className="p-4 text-gray-500">{session.date}</td>
                <td className="p-4 text-blue-400">{session.leads.toLocaleString()}</td>
                
                {/* Download Dropdown UI */}
                <td className="p-4 relative text-right">
                  <button 
                    onClick={() => setActiveDropdown(activeDropdown === session.id ? null : session.id)}
                    className="inline-flex items-center gap-2 bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-colors font-sans"
                  >
                    <DownloadCloud size={16} /> Export
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === session.id && (
                    <div className="absolute right-4 mt-2 w-48 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden text-left font-sans">
                      
                      <button onClick={() => handleDownload(session.id, 'csv')} className="w-full flex items-center gap-3 p-3 hover:bg-gray-800 transition text-gray-300">
                        <FileText size={16} className="text-blue-400"/> Direct CSV
                      </button>
                      
                      <button onClick={() => handleDownload(session.id, 'pdf')} className="w-full flex items-center gap-3 p-3 hover:bg-gray-800 border-y border-gray-800 transition text-gray-300">
                        <PdfIcon size={16} className="text-red-400"/> Stylized PDF
                      </button>
                      
                      <button onClick={() => handleDownload(session.id, 'gsheet')} className="w-full flex items-center gap-3 p-3 hover:bg-gray-800 transition text-gray-300">
                        <Table size={16} className="text-green-500"/> Sync Google Sheet
                      </button>

                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
