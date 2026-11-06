import { NavLink } from 'react-router-dom';
import { Home, MessageCircle, ScanLine, Brain, User } from 'lucide-react';

const TABS = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/chat', label: '聊天', icon: MessageCircle },
  { to: '/analyze', label: '分析', icon: ScanLine },
  { to: '/learn', label: '学习', icon: Brain },
  { to: '/profile', label: '我的', icon: User },
];

export default function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-gray-100 safe-area-bottom">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                isActive ? 'text-pink-500' : 'text-gray-400'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
