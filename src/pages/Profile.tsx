import { Link } from 'react-router-dom';
import { ArrowLeft, User, Settings, LogOut, Phone, CalendarDays } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import LoginCard from '@/components/LoginCard';

export default function Profile() {
  const { preferences } = useSettingsStore();
  const { token, user, clearAuth } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="font-semibold text-gray-800">个人中心</h1>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* 账号卡片 */}
        {token && user ? (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-800 truncate">{user.nickname}</h2>
                <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-0.5">
                  <Phone className="w-3.5 h-3.5" />
                  {user.phone}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-4">
              <CalendarDays className="w-3.5 h-3.5" />
              注册于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
        ) : (
          <LoginCard />
        )}

        {/* 当前设置 */}
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

          {token && (
            <button
              onClick={clearAuth}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-xl shadow hover:shadow-md transition-shadow text-left text-red-500"
            >
              <LogOut className="w-5 h-5" />
              <span>退出登录</span>
            </button>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          情感AI伴侣 v1.0.0
        </p>
      </div>
    </div>
  );
}
