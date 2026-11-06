import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Diary from "@/pages/Diary";
import Learn from "@/pages/Learn";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Analyze from "@/pages/Analyze";
import BottomNav from "@/components/BottomNav";

export default function App() {
  return (
    <Router>
      {/* pb-24 为移动端底部导航留出空间（桌面端隐藏导航则无影响可忽略） */}
      <div className="pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/diary" element={<Diary />} />
          <Route path="/diary/new" element={<Diary />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/learn/upload" element={<Learn />} />
          <Route path="/analyze" element={<Analyze />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
      <BottomNav />
    </Router>
  );
}
