import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, User, Key, Settings, LogOut, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

export default function Profile() {
  const { apiKey, setApiKey, preferences } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);
  const [inputKey, setInputKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  const handleSaveKey = () => {
    setApiKey(inputKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="font-semibold text-gray-800">个人中心</h1>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800">情感AI用户</h2>
          <p className="text-gray-500 text-sm">免费用户</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="font-semibold text-gray-800">API Key 设置</h2>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-700">
              API Key 仅保存在您的浏览器本地，不会上传到服务器。请确保您有 OpenAI 账户余额。
            </p>
          </div>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-3 bg-gray-100 rounded-xl pr-12 text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400"
            >
              {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={handleSaveKey}
            disabled={inputKey === apiKey}
            className={`w-full mt-3 py-3 rounded-xl font-medium transition-colors ${
              saved
                ? 'bg-green-500 text-white'
                : 'bg-gradient-to-r from-pink-500 to-purple-500 text-white disabled:opacity-50'
            }`}
          >
            {saved ? '已保存 ✓' : '保存 API Key'}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-3">当前设置</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">恋爱状态</span>
              <span className="text-gray-800 font-medium">
                {preferences.relationshipStatus === 'single' && '单身'}
                {preferences.relationshipStatus === 'crush' && '暗恋中'}
                {preferences.relationshipStatus === 'dating' && '恋爱中'}
                {preferences.relationshipStatus === 'married' && '已婚'}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">AI性格</span>
              <span className="text-gray-800 font-medium">
                {preferences.aiStyle === 'gentle' && '温柔型'}
                {preferences.aiStyle === 'rational' && '理性型'}
                {preferences.aiStyle === 'humorous' && '幽默型'}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">兴趣话题</span>
              <span className="text-gray-800 font-medium">{preferences.interests.length} 个</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Link
            to="/settings"
            className="flex items-center gap-3 p-4 bg-white rounded-xl shadow hover:shadow-md transition-shadow"
          >
            <Settings className="w-5 h-5 text-gray-600" />
            <span className="text-gray-800">偏好设置</span>
          </Link>

          <button
            className="w-full flex items-center gap-3 p-4 bg-white rounded-xl shadow hover:shadow-md transition-shadow text-left text-red-500"
          >
            <LogOut className="w-5 h-5" />
            <span>退出登录</span>
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          情感AI伴侣 v1.0.0
        </p>
      </div>
    </div>
  );
}
