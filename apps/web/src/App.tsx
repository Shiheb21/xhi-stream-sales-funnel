import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LiveHistory } from './pages/LiveHistory';
import { Settings } from './pages/Settings';
import { Server, Clock, Settings2 } from 'lucide-react';

/**
 * XHI Mission Control — Zero-Dependency SPA Router
 * Uses standard HTML5 History API to parse component loads without crashing under strict Node/Vite workspaces.
 */
function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  return (
    <div className="flex h-screen bg-black overflow-hidden font-sans text-gray-200">
      
      {/* GLOBAL SIDEBAR (Mission Control Nav) */}
      <aside className="w-20 lg:w-64 border-r border-gray-800 bg-gray-950 flex flex-col justify-between hidden md:flex shrink-0">
        <div>
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-gray-800 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20 shrink-0"></div>
            <span className="hidden lg:block ml-3 font-bold text-xl tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">XHI</span>
          </div>

          <nav className="mt-8 px-2 space-y-2">
            
            <button 
              onClick={() => navigate('/')} 
              className={`w-full flex items-center justify-center lg:justify-start px-2 lg:px-4 py-3 rounded-xl transition-all group ${currentPath === '/' ? 'bg-blue-600/10 text-blue-500 relative' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}`}
            >
              {currentPath === '/' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full" />}
              <Server size={22} className={currentPath === '/' ? 'text-blue-500' : 'group-hover:scale-110 transition-transform'} />
              <span className="hidden lg:block ml-4 font-semibold tracking-wide">Dashboard (Live)</span>
            </button>

            <button 
              onClick={() => navigate('/history')} 
              className={`w-full flex items-center justify-center lg:justify-start px-2 lg:px-4 py-3 rounded-xl transition-all group ${currentPath === '/history' ? 'bg-purple-600/10 text-purple-500 relative' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}`}
            >
              {currentPath === '/history' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500 rounded-r-full" />}
              <Clock size={22} className={currentPath === '/history' ? 'text-purple-500' : 'group-hover:scale-110 transition-transform'} />
              <span className="hidden lg:block ml-4 font-semibold tracking-wide">Session History</span>
            </button>
            
          </nav>
        </div>

        <div className="p-2 border-t border-gray-800">
          <button 
            onClick={() => navigate('/settings')} 
            className={`w-full flex items-center justify-center lg:justify-start px-2 lg:px-4 py-3 rounded-xl transition-all group ${currentPath === '/settings' ? 'bg-gray-800 text-white relative' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}`}
          >
            {currentPath === '/settings' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gray-500 rounded-r-full" />}
            <Settings2 size={22} className="group-hover:rotate-45 transition-transform" />
            <span className="hidden lg:block ml-4 font-semibold tracking-wide">Settings</span>
          </button>
        </div>
      </aside>

      {/* CORE ROUTING ENGINE */}
      <main className="flex-1 overflow-auto bg-black custom-scrollbar">
        {currentPath === '/' && <DashboardLayout navigateHistory={() => navigate('/history')} navigateSettings={() => navigate('/settings')} />}
        {currentPath === '/history' && <LiveHistory />}
        {currentPath === '/settings' && <Settings />}
        {![ '/', '/history', '/settings'].includes(currentPath) && (
           <div className="flex h-full items-center justify-center text-gray-500 font-mono flex-col gap-4">
               <h1 className="text-6xl font-bold text-gray-800">404</h1>
               <p>The requested Speckit Route "{currentPath}" does not exist.</p>
               <button onClick={() => navigate('/')} className="text-blue-500 hover:underline">Return to Mission Control</button>
           </div>
        )}
      </main>
      
    </div>
  );
}

export default App;
