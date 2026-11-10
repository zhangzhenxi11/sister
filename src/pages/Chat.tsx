import { useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Plus, Trash2, Settings, Sparkles, User, Check, ChevronDown, Image, X } from 'lucide-react';
import { useChatStore, type Message } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useLearnStore, type Persona } from '@/stores/learnStore';
import { authFetch } from '@/stores/authStore';
import { compressImage, blobToBase64 } from '@/lib/imageCompress';
import { v4 as uuidv4 } from 'uuid';

export default function Chat() {
  const { id } = useParams();
  const { conversations, currentConversationId, isLoading, addConversation, setCurrentConversation, addMessage, setLoading, deleteConversation } = useChatStore();
  const { preferences } = useSettingsStore();
  const { activePersonaId, personas, setActivePersona } = useLearnStore();
  
  const [input, setInput] = useState('');
  const [useRag, setUseRag] = useState(true);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentConversation = conversations.find(c => c.id === (id || currentConversationId));

  useEffect(() => {
    if (id && id !== currentConversationId) {
      setCurrentConversation(id);
    }
  }, [id, currentConversationId, setCurrentConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('handleImageSelect called, file:', file);
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('图片大小不能超过10MB');
        return;
      }
      console.log('Setting selectedImage:', file.name, file.size, file.type);
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('FileReader loaded, preview set');
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const imageToSend = selectedImage;
    const textToSend = input;

    let conversationId = currentConversation?.id;

    if (!conversationId) {
      const newConversation = {
        id: uuidv4(),
        title: textToSend.slice(0, 30) || '图片对话',
        messages: [],
        createdAt: new Date(),
      };
      addConversation(newConversation);
      conversationId = newConversation.id;
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
      imageUrl: imagePreview || undefined,
    };

    addMessage(conversationId!, userMessage);
    setInput('');
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLoading(true);

    try {
      let imageBase64 = null;
      if (imageToSend) {
        console.log('Compressing image:', imageToSend.name, imageToSend.size, imageToSend.type);
        const compressed = await compressImage(imageToSend);
        const base64 = await blobToBase64(compressed);
        // 保持 data URI 形式：后端识图逻辑按 data: 前缀走 OCR 路径
        imageBase64 = `data:image/jpeg;base64,${base64}`;
        console.log('Compressed size:', compressed.size);
      } else {
        console.log('No image to upload');
      }

      const response = await authFetch('/api/chat/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          conversationId,
          personaId: activePersonaId,
          useRag,
          image: imageBase64,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        const aiMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date(),
        };
        addMessage(conversationId!, aiMessage);
      } else {
        const errorMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: '抱歉，我现在无法回复。请稍后再试。',
          timestamp: new Date(),
        };
        addMessage(conversationId!, errorMessage);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: '网络错误，请检查连接后重试。',
        timestamp: new Date(),
      };
      addMessage(conversationId!, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
  };

  const activePersona = personas.find(p => p.id === activePersonaId);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-pink-50 to-purple-50">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="font-semibold text-gray-800">AI聊天</h1>
            {activePersona && (
              <p className="text-xs text-purple-600">人格: {activePersona.name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowPersonaSelector(!showPersonaSelector)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                activePersona 
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span className="text-sm">{activePersona ? activePersona.name : '选择人格'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {showPersonaSelector && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border z-10 overflow-hidden">
                <div className="p-2 border-b">
                  <p className="text-xs text-gray-500 px-2">选择人格模板</p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setActivePersona(null);
                      setShowPersonaSelector(false);
                    }}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 ${
                      !activePersona ? 'bg-pink-50' : ''
                    }`}
                  >
                    <span className="text-sm text-gray-700">默认AI</span>
                    {!activePersona && <Check className="w-4 h-4 text-pink-500" />}
                  </button>
                  {personas.map(persona => (
                    <button
                      key={persona.id}
                      onClick={() => {
                        setActivePersona(persona.id);
                        setShowPersonaSelector(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 ${
                        activePersonaId === persona.id ? 'bg-pink-50' : ''
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{persona.name}</p>
                        <p className="text-xs text-gray-500 truncate">{persona.description?.slice(0, 20) || '自定义人格'}</p>
                      </div>
                      {activePersonaId === persona.id && <Check className="w-4 h-4 text-pink-500" />}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t bg-gray-50">
                  <Link 
                    to="/learn" 
                    onClick={() => setShowPersonaSelector(false)}
                    className="block text-center text-xs text-pink-500 hover:text-pink-600 py-1"
                  >
                    去创建新人格
                  </Link>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setUseRag(!useRag)}
            className={`p-2 rounded-full ${useRag ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'}`}
            title={useRag ? '已启用RAG学习' : '使用通用模式'}
          >
            <Sparkles className="w-5 h-5" />
          </button>
          <Link to="/chat" onClick={handleNewChat} className="p-2 hover:bg-gray-100 rounded-full">
            <Plus className="w-5 h-5 text-gray-600" />
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {conversations.length > 0 && (
          <div className="w-20 bg-white border-r overflow-y-auto">
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setCurrentConversation(conv.id)}
                className={`p-3 border-b cursor-pointer hover:bg-gray-50 group relative ${conv.id === currentConversation?.id ? 'bg-pink-50 border-l-4 border-l-pink-500' : ''}`}
              >
                <div className="text-xs text-gray-600 truncate pr-6">{conv.title || '新对话'}</div>
                <div className="text-xs text-gray-400">{conv.messages.length} 条</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('确定删除这个聊天记录吗？')) {
                      deleteConversation(conv.id);
                    }
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!currentConversation?.messages.length && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">开始聊天</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                  {useRag 
                    ? '正在使用你的学习资料进行RAG增强回复'
                    : '分享你的情感困惑，我来帮你分析和建议'}
                </p>
              </div>
            )}

            {currentConversation?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                      : 'bg-white text-gray-800 shadow-md'
                  }`}
                >
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="上传的图片"
                      className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(msg.imageUrl, '_blank')}
                    />
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-pink-100' : 'text-gray-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-3 shadow-md">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 bg-white border-t">
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img src={imagePreview} alt="预览" className="max-h-24 rounded-lg" />
                <button
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                title="上传图片"
              >
                <Image className="w-5 h-5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="输入你的问题..."
                className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() && !selectedImage || isLoading}
                className="p-3 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
