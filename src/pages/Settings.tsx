import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Sparkles, Moon, Sun, KeyRound, Eye, EyeOff, Check, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '@/stores/settingsStore';

export default function Settings() {
  const { preferences, setPreferences, theme, setTheme, apiKey, llmBaseUrl, llmModel, setLlmConfig } = useSettingsStore();

  const [keyInput, setKeyInput] = useState(apiKey);
  const [baseUrlInput, setBaseUrlInput] = useState(llmBaseUrl);
  const [modelInput, setModelInput] = useState(llmModel);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveLlm = () => {
    setLlmConfig({ apiKey: keyInput, baseUrl: baseUrlInput, model: modelInput });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetLlm = () => {
    setKeyInput('');
    setBaseUrlInput('');
    setModelInput('');
    setLlmConfig({ apiKey: '', baseUrl: '', model: '' });
  };

  const relationshipOptions = [
    { value: 'single', label: '单身' },
    { value: 'crush', label: '暗恋中' },
    { value: 'dating', label: '恋爱中' },
    { value: 'married', label: '已婚' },
  ];

  const interestOptions = [
    { value: 'dating_tips', label: '约会技巧' },
    { value: 'communication', label: '沟通技巧' },
    { value: 'emotion_control', label: '情绪管理' },
    { value: 'relationship_maintenance', label: '关系维护' },
    { value: 'self_growth', label: '自我成长' },
  ];

  const styleOptions = [
    { value: 'gentle', label: '温柔型', desc: '温暖、耐心、充满理解' },
    { value: 'rational', label: '理性型', desc: '逻辑清晰、客观分析' },
    { value: 'humorous', label: '幽默型', desc: '轻松有趣、化解尴尬' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-3">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="font-semibold text-gray-800">偏好设置</h1>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* 大模型配置 */}
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-500" />
            </div>
            <h2 className="font-semibold text-gray-800">大模型配置</h2>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            填写后所有 AI 功能（截图分析、聊天、学习）使用你的 Key；留空则使用服务器默认配置。Key 只保存在本机浏览器。
          </p>

          <label className="block text-xs text-gray-500 mb-1">API Key</label>
          <div className="relative mb-3">
            <input
              type={showKey ? 'text' : 'password'}
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 bg-gray-100 rounded-xl pr-11 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <label className="block text-xs text-gray-500 mb-1">Base URL（可选）</label>
          <input
            type="text"
            value={baseUrlInput}
            onChange={e => setBaseUrlInput(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
            className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 mb-3"
          />

          <label className="block text-xs text-gray-500 mb-1">模型名（可选）</label>
          <input
            type="text"
            value={modelInput}
            onChange={e => setModelInput(e.target.value)}
            placeholder="deepseek-chat / gpt-4o-mini ..."
            className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 mb-3"
          />

          <div className="flex gap-2">
            <button
              onClick={handleSaveLlm}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${
                saved ? 'bg-emerald-500' : 'bg-gradient-to-r from-pink-500 to-purple-500'
              }`}
            >
              {saved ? '已保存' : '保存配置'}
            </button>
            {(apiKey || keyInput) && (
              <button
                onClick={handleResetLlm}
                className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm flex items-center gap-1"
              >
                <RotateCcw className="w-4 h-4" /> 恢复默认
              </button>
            )}
          </div>
          {apiKey && (
            <p className="flex items-center gap-1 text-[11px] text-emerald-600 mt-2">
              <Check className="w-3 h-3" /> 自定义 Key 生效中
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-pink-500" />
            </div>
            <h2 className="font-semibold text-gray-800">恋爱状态</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {relationshipOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setPreferences({ relationshipStatus: option.value })}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                  preferences.relationshipStatus === option.value
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-500" />
            </div>
            <h2 className="font-semibold text-gray-800">兴趣话题</h2>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {interestOptions.map(option => {
              const isSelected = preferences.interests.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    const newInterests = isSelected
                      ? preferences.interests.filter(i => i !== option.value)
                      : [...preferences.interests, option.value];
                    setPreferences({ interests: newInterests });
                  }}
                  className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-violet-500" />
            </div>
            <h2 className="font-semibold text-gray-800">AI性格</h2>
          </div>
          
          <div className="space-y-2">
            {styleOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setPreferences({ aiStyle: option.value as 'gentle' | 'rational' | 'humorous' })}
                className={`w-full p-3 rounded-xl text-left transition-colors ${
                  preferences.aiStyle === option.value
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <p className={`font-medium ${preferences.aiStyle === option.value ? 'text-white' : 'text-gray-800'}`}>
                  {option.label}
                </p>
                <p className={`text-xs ${preferences.aiStyle === option.value ? 'text-pink-100' : 'text-gray-500'}`}>
                  {option.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                {theme === 'dark' ? (
                  <Moon className="w-5 h-5 text-indigo-500" />
                ) : (
                  <Sun className="w-5 h-5 text-indigo-500" />
                )}
              </div>
              <h2 className="font-semibold text-gray-800">深色模式</h2>
            </div>
            
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={`w-12 h-6 rounded-full transition-colors ${
                theme === 'dark' ? 'bg-indigo-500' : 'bg-gray-200'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                theme === 'dark' ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
