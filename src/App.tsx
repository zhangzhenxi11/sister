import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Diary from "@/pages/Diary";
import Learn from "@/pages/Learn";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:id" element={<Chat />} />
        <Route path="/diary" element={<Diary />} />
        <Route path="/diary/new" element={<Diary />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/upload" element={<Learn />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Router>
  );
}
