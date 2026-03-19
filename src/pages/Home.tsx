import { Link } from 'react-router-dom';
import { MessageCircle, BookOpen, Heart, Settings, User, Brain } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
            情感AI伴侣
          </h1>
          <p className="text-gray-600">你的私人情感顾问</p>
        </div>

        <div className="space-y-4">
          <Link
            to="/chat"
            className="block bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-pink-400 to-pink-600 rounded-2xl flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">AI聊天</h3>
                <p className="text-sm text-gray-500">获取恋爱建议和情感指导</p>
              </div>
            </div>
          </Link>

          <Link
            to="/learn"
            className="block bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">多模态学习</h3>
                <p className="text-sm text-gray-500">上传资料，定制专属AI人格</p>
              </div>
            </div>
          </Link>

          <Link
            to="/diary"
            className="block bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-rose-400 to-rose-600 rounded-2xl flex items-center justify-center">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">心情日记</h3>
                <p className="text-sm text-gray-500">记录情感变化</p>
              </div>
            </div>
          </Link>

          <Link
            to="/settings"
            className="block bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-violet-400 to-violet-600 rounded-2xl flex items-center justify-center">
                <Settings className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">偏好设置</h3>
                <p className="text-sm text-gray-500">定制AI回复风格</p>
              </div>
            </div>
          </Link>

          <Link
            to="/profile"
            className="block bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl flex items-center justify-center">
                <User className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">个人中心</h3>
                <p className="text-sm text-gray-500">账户和API设置</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Heart className="w-6 h-6 text-pink-400 mx-auto mb-2" />
          <p className="text-xs text-gray-400">用AI赋能你的情感成长</p>
        </div>
      </div>
    </div>
  );
}
