import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  return (
    <div className="flex h-full w-full">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col lg:ml-sidebar-width overflow-hidden">
        {/* Mobile top bar with hamburger — hidden on desktop */}
        <header className="lg:hidden flex items-center gap-2 h-14 px-4 border-b border-outline-variant bg-white shrink-0 z-30">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-2 -ml-2 text-on-surface hover:bg-surface-container-low rounded-lg"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="font-headline-md text-lg font-bold text-primary">Chat Flow</span>
        </header>

        <main className="flex-1 min-w-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
