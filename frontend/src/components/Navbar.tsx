import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="flex items-center justify-between bg-primary px-6 py-4 text-white">
      <Link to="/dashboard" className="text-lg font-semibold">
        Student Notes Chatbot
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link to="/dashboard" className="hover:underline">Dashboard</Link>
        <Link to="/notes" className="hover:underline">Notes</Link>
        <Link to="/chat" className="hover:underline">Chat</Link>
        {user && <span className="text-gray-200">{user.full_name}</span>}
        <button onClick={handleLogout} className="rounded bg-primary-light px-3 py-1 hover:bg-white hover:text-primary">
          Logout
        </button>
      </div>
    </nav>
  );
}
