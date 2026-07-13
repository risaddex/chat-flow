import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard/conversations', label: 'Inbox', icon: 'inbox' },
  { to: '/dashboard/contacts', label: 'Contacts', icon: 'contacts' },
  { to: '/dashboard/cases', label: 'Cases', icon: 'folder_shared' },
  { to: '/dashboard/analytics', label: 'Analytics', icon: 'analytics' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Backdrop — mobile only, when the drawer is open */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-sidebar-width bg-primary-container text-on-primary flex flex-col border-r border-outline-variant z-50 transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <div className="font-display-lg text-display-lg font-bold text-on-primary">Chat Flow</div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden p-1 -mr-1 text-on-primary-container hover:bg-surface-variant/10 rounded-lg"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const active = item.to === '/dashboard/conversations'
              ? location.pathname.startsWith('/dashboard/conversations')
              : location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`flex items-center gap-stack-md px-4 py-3 rounded-lg cursor-pointer active:scale-95 transition-all ${
                  active
                    ? 'bg-secondary-container text-on-secondary-container border-l-4 border-secondary'
                    : 'text-on-primary-container hover:bg-surface-variant/10'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button onClick={handleLogout}
            className="flex items-center gap-stack-md text-on-primary-container hover:bg-surface-variant/10 px-4 py-3 rounded-lg cursor-pointer transition-all w-full">
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
