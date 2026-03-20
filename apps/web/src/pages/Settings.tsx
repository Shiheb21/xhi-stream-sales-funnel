import React, { useState } from 'react';
import { Save, Settings as SettingsIcon, Mail, Table, FileText } from 'lucide-react';

export const Settings: React.FC = () => {
  const [autoExportGsheet, setAutoExportGsheet] = useState(false);
  const [autoExportCsv, setAutoExportCsv] = useState(false);
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Simulating POST /api/settings which saves to UserConfig PostgreSQL table
    setTimeout(() => {
      setIsSaving(false);
      alert('Settings saved successfully!');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 p-8 font-sans">
      <header className="mb-10 flex items-center gap-4 border-b border-gray-800 pb-6">
        <SettingsIcon size={32} className="text-blue-500" />
        <h1 className="text-3xl font-bold tracking-widest text-white">SYSTEM <span className="text-gray-500 font-light">SETTINGS</span></h1>
      </header>

      <div className="max-w-2xl bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2"><FileText size={20}/> Export Automation</h2>
        
        <div className="space-y-6">
          {/* Checkbox: Auto-export to Google Sheets */}
          <label className="flex items-center space-x-4 cursor-pointer p-4 border border-gray-800 rounded-lg hover:border-gray-700 transition font-medium">
            <input 
              type="checkbox" 
              className="w-5 h-5 rounded border-gray-700 text-blue-500 focus:ring-blue-600 bg-gray-800"
              checked={autoExportGsheet}
              onChange={(e) => setAutoExportGsheet(e.target.checked)}
            />
            <Table size={18} className="text-green-500" />
            <span>Auto-export streams to Google Sheets</span>
          </label>

          {/* Checkbox: Auto-export CSV to Email */}
          <label className="flex items-center space-x-4 cursor-pointer p-4 border border-gray-800 rounded-lg hover:border-gray-700 transition font-medium">
            <input 
              type="checkbox" 
              className="w-5 h-5 rounded border-gray-700 text-blue-500 focus:ring-blue-600 bg-gray-800"
              checked={autoExportCsv}
              onChange={(e) => setAutoExportCsv(e.target.checked)}
            />
            <FileText size={18} className="text-blue-400" />
            <span>Auto-export CSV summaries to Email</span>
          </label>

          {/* Input: Notification Email */}
          <div className="pt-4 border-t border-gray-800">
            <label className="block text-sm font-medium tracking-wide mb-2 flex items-center gap-2">
              <Mail size={16}/> Daily Notification Email
            </label>
            <input 
              type="email" 
              placeholder="sales@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-lg px-4 py-3 text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-gray-500 mt-2">Daily automated lead digest schedules will be sent here.</p>
          </div>
        </div>

        {/* Save Persistence */}
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="mt-10 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold tracking-wide transition-colors"
        >
          <Save size={18} />
          {isSaving ? 'UPDATING USERCONFIG...' : 'SAVE SETTINGS'}
        </button>
      </div>
    </div>
  );
};
