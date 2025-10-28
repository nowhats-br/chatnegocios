import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  PlugZap,
  KanbanSquare,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';


const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/conexoes', icon: PlugZap, label: 'Conexões' },
  { to: '/atendimentos', icon: MessageSquare, label: 'Atendimentos' },
  { to: '/kanban', icon: KanbanSquare, label: 'Kanban' },
  { to: '/cadastros', icon: Users, label: 'Cadastros' },
];

const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);


  return (
    <motion.div
      animate={{ width: isCollapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative flex flex-col h-full bg-card border-r text-foreground"
    >
      <div className="flex items-center justify-center p-4 h-[65px] border-b">
        <Command className="text-primary h-7 w-7" />
        <AnimatePresence>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="typography-h4 font-bold ml-3"
            >
              Chatvendas
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            title={item.label}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 h-10 rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary text-primary-foreground",
                isCollapsed && "justify-center"
              )
            }
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="ml-4 typography-body-sm font-semibold"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t space-y-1.5">
         <NavLink
            to="/configuracoes"
            title="Configurações"
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 h-10 rounded-lg transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "bg-primary text-primary-foreground",
                isCollapsed && "justify-center"
              )
            }
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="ml-4 typography-body-sm font-semibold"
                >
                  Configurações
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
      </div>

      <div className="p-2 border-t">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-accent"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
