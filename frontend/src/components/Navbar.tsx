import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BookOpen, MessageSquare, LogOut, FileText, User as UserIcon } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-900 bg-slate-950/70 px-8 py-4 text-slate-200 backdrop-blur-lg">
      <Link to="/dashboard" className="flex items-center gap-2 group">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
          <BookOpen className="h-5 w-5" />
        </div>
        <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-lg font-bold tracking-wide text-transparent transition-all duration-300 group-hover:from-indigo-300 group-hover:to-purple-300">
          EduNotes AI
        </span>
      </Link>
      
      <div className="flex items-center gap-6 text-sm">
        <Link 
          to="/dashboard" 
          className={`flex items-center gap-1.5 font-medium transition-colors hover:text-indigo-400 ${
            isActive("/dashboard") ? "text-indigo-400" : "text-slate-400"
          }`}
        >
          <UserIcon className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
        <Link 
          to="/notes" 
          className={`flex items-center gap-1.5 font-medium transition-colors hover:text-indigo-400 ${
            isActive("/notes") ? "text-indigo-400" : "text-slate-400"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Notes</span>
        </Link>
        <Link 
          to="/chat" 
          className={`flex items-center gap-1.5 font-medium transition-colors hover:text-indigo-400 ${
            isActive("/chat") ? "text-indigo-400" : "text-slate-400"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Chat</span>
        </Link>
        
        {user && (
          <div className="h-4 w-px bg-slate-800" />
        )}
        
        {user && (
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <span className="max-w-[120px] truncate font-medium text-slate-300">{user.full_name}</span>
          </div>
        )}
        
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/50 px-4.5 py-1.5 font-medium text-slate-300 transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </nav>
  );
}
