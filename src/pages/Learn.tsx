import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Video, Music, Image, Trash2, Brain, Play, Check, Sparkles, File, RefreshCw, FolderOpen, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useLearnStore, type LearningMaterial, type Persona } from '@/stores/learnStore';
import { v4 as uuidv4 } from 'uuid';

const typeIcons: Record<LearningMaterial['type'], typeof FileText> = {
  video: Video,
  audio: Music,
  image: Image,
  text: FileText,
  pdf: File,
};

const typeColors: Record<LearningMaterial['type'], string> = {
  video: 'bg-red-100 text-red-600',
  audio: 'bg-blue-100 text-blue-600',
  image: 'bg-green-100 text-green-600',
  text: 'bg-purple-100 text-purple-600',
  pdf: 'bg-orange-100 text-orange-600',
};

export default function Learn() {
  const { materials, personas, activePersonaId, addMaterial, updateMaterial, removeMaterial, addPersona, setActivePersona, updatePersona } = useLearnStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localFiles, setLocalFiles] = useState<Array<{name: string; size: number; uploadedAt: Date}>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCreatePersona, setShowCreatePersona] = useState(false);
  const [showPersonaDetail, setShowPersonaDetail] = useState<string | null>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [createdPersonaName, setCreatedPersonaName] = useState('');
  const [personaName, setPersonaName] = useState('');
  const [personaDesc, setPersonaDesc] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchLocalFiles();
    fetchMaterials();
  }, []);

  const fetchLocalFiles = async () => {
    try {
      const response = await fetch('/api/learn/local-files');
      const data = await response.json();
      if (data.success) {
        setLocalFiles(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch local files:', error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/learn/materials');
      const data = await response.json();
      if (data.success && data.data) {
        data.data.forEach((m: any) => {
          if (!materials.find(existing => existing.id === m.id)) {
            addMaterial({
              id: m.id,
              title: m.title,
              description: m.description,
              type: m.type,
              status: m.status,
              summary: m.summary,
              createdAt: new Date(m.createdAt),
            });
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch materials:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    let type: LearningMaterial['type'] = 'text';
    
    if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) type = 'video';
    else if (['mp3', 'wav', 'aac', 'm4a'].includes(ext)) type = 'audio';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) type = 'image';
    else if (ext === 'pdf') type = 'pdf';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('title', file.name);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/learn/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (data.success) {
        addMaterial({
          id: data.data.id,
          title: data.data.title,
          description: data.data.description,
          type: data.data.type,
          status: data.data.status,
          summary: data.data.summary,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCreatePersona = async () => {
    if (selectedMaterials.length === 0) return;

    setIsCreating(true);

    try {
      const response = await fetch('/api/learn/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          description: '',
          style: 'custom',
          materialIds: selectedMaterials,
        }),
      });

      const data = await response.json();
      console.log('Create persona response:', data);

      if (data.success) {
        addPersona({
          id: data.data.id,
          name: data.data.name,
          description: data.data.description,
          style: data.data.style,
          isActive: true,
          materialIds: selectedMaterials,
        });
        setActivePersona(data.data.id);
        setCreatedPersonaName(data.data.name);
        setShowSuccessPopup(true);
      } else {
        alert('创建失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('Create persona error:', error);
      alert('创建失败，请检查网络连接');
    }

    setShowCreatePersona(false);
    setPersonaName('');
    setPersonaDesc('');
    setSelectedMaterials([]);
    setIsCreating(false);
  };

  const handleActivatePersona = async (persona: Persona) => {
    try {
      await fetch(`/api/learn/persona/${persona.id}/activate`, {
        method: 'PUT',
      });
    } catch (error) {
      console.error('Activate error:', error);
    }
    setActivePersona(persona.isActive ? null : persona.id);
  };

  const handleReflection = async (personaId: string) => {
    try {
      const response = await fetch(`/api/learn/persona/${personaId}/reflect`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        alert(`反思完成！\n洞察: ${data.data.insights.join('\n')}\n改进: ${data.data.improvements.join('\n')}`);
      }
    } catch (error) {
      console.error('Reflection error:', error);
    }
  };

  const toggleMaterialSelection = (id: string) => {
    setSelectedMaterials(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const completedMaterials = materials.filter(m => m.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 pb-20">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="font-semibold text-gray-800">多模态学习</h1>
        </div>
        <Link to="/chat" className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full text-sm font-medium">
          开始聊天
        </Link>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            人格塑造流程
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 font-bold text-sm">1</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">上传学习资料</p>
                <p className="text-xs text-gray-500">视频/语音/文章/图片/PDF</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-bold text-sm">2</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">选择资料创建人格</p>
                <p className="text-xs text-gray-500">AI分析内容，生成专属人格</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">3</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">应用人格聊天</p>
                <p className="text-xs text-gray-500">对话中学习，持续优化</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4">上传学习资料</h2>
          
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept="video/*,audio/*,image/*,.txt,.md,.pdf"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-pink-300 transition-colors cursor-pointer"
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">点击上传学习资料</p>
            <p className="text-gray-400 text-xs mt-1">支持视频、语音、图片、PDF、文章</p>
          </div>

          {uploading && (
            <div className="mt-4">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">正在处理: {uploadProgress}%</p>
            </div>
          )}
        </div>

        {localFiles.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-gray-600" />
              本地已上传文件
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {localFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(file.uploadedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">共 {localFiles.length} 个文件</p>
          </div>
        )}

        {completedMaterials.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              可用的学习资料
              <span className="ml-auto text-xs text-gray-400">勾选后创建人格</span>
            </h2>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {completedMaterials.map(material => {
                const Icon = typeIcons[material.type] || FileText;
                return (
                  <div
                    key={material.id}
                    onClick={() => toggleMaterialSelection(material.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      selectedMaterials.includes(material.id) 
                        ? 'bg-pink-50 ring-2 ring-pink-500' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${typeColors[material.type]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{material.title}</p>
                      {material.summary && (
                        <p className="text-xs text-gray-500 truncate">{material.summary}</p>
                      )}
                    </div>
                    {selectedMaterials.includes(material.id) ? (
                      <Check className="w-5 h-5 text-pink-500 flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                );
              })}
            </div>

            {selectedMaterials.length > 0 && (
              <button
                onClick={() => setShowCreatePersona(true)}
                className="w-full mt-4 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                一键AI分析创建人格
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h2 className="font-semibold text-gray-800 mb-4">已创建的人格</h2>
          
          {personas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              暂无人格模板<br/>
              <span className="text-xs">上传资料后可创建专属人格</span>
            </p>
          ) : (
            <div className="space-y-3">
              {personas.map(persona => (
                <div
                  key={persona.id}
                  className={`p-4 rounded-xl transition-all ${
                    persona.isActive 
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                      : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${persona.isActive ? 'bg-white/20' : 'bg-purple-100'}`}>
                        <Brain className={`w-5 h-5 ${persona.isActive ? 'text-white' : 'text-purple-600'}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{persona.name}</h3>
                        <p className={`text-xs mt-1 ${persona.isActive ? 'text-pink-100' : 'text-gray-500'}`}>
                          {persona.description?.slice(0, 50) || '暂无描述'}...
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {!persona.isActive && (
                        <button
                          onClick={() => handleActivatePersona(persona)}
                          className="px-3 py-1 bg-purple-500 text-white text-xs rounded-full"
                        >
                          应用
                        </button>
                      )}
                      {persona.isActive && (
                        <span className="px-3 py-1 bg-white/20 text-white text-xs rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />应用中
                        </span>
                      )}
                    </div>
                  </div>

                  {persona.materialIds && persona.materialIds.length > 0 && (
                    <div className={`mt-3 pt-3 border-t ${persona.isActive ? 'border-white/20' : 'border-gray-200'}`}>
                      <p className={`text-xs ${persona.isActive ? 'text-pink-100' : 'text-gray-500'}`}>
                        已学习 {persona.materialIds.length} 个资料
                      </p>
                    </div>
                  )}

                  <div className={`mt-3 flex gap-2 ${persona.isActive ? 'opacity-80' : ''}`}>
                    <button
                      onClick={() => handleReflection(persona.id)}
                      className={`flex-1 py-2 rounded-lg text-xs flex items-center justify-center gap-1 ${
                        persona.isActive 
                          ? 'bg-white/20 hover:bg-white/30' 
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      <RefreshCw className="w-3 h-3" />
                      反思优化
                    </button>
                    <button
                      onClick={() => setShowPersonaDetail(persona.id)}
                      className={`flex-1 py-2 rounded-lg text-xs ${
                        persona.isActive 
                          ? 'bg-white/20 hover:bg-white/30' 
                          : 'bg-gray-200 hover:bg-gray-300'
                      }`}
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreatePersona && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-500" />
              AI分析创建人格
            </h3>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-600">AI将分析以下 {selectedMaterials.length} 个学习资料，自动生成专属人格：</p>
              
              <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-xl">
                {selectedMaterials.map(id => {
                  const material = materials.find(m => m.id === id);
                  return material ? (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="truncate">{material.title}</span>
                    </div>
                  ) : null;
                })}
              </div>

              <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-4 rounded-xl">
                <p className="text-xs text-gray-600">
                  <Sparkles className="w-4 h-4 inline text-pink-500 mr-1" />
                  AI将自动生成：人格名称、性格描述、说话风格、对话规则
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreatePersona(false);
                  setSelectedMaterials([]);
                }}
                className="flex-1 py-3 text-gray-600"
                disabled={isCreating}
              >
                取消
              </button>
              <button
                onClick={handleCreatePersona}
                disabled={isCreating}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    AI分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    开始创建
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">创建成功！</h3>
            <p className="text-gray-600 mb-2">人格 <span className="font-semibold text-pink-500">{createdPersonaName}</span> 已创建</p>
            <p className="text-sm text-gray-500 mb-4">已自动应用该人格</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSuccessPopup(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                留在本页
              </button>
              <Link
                to="/chat"
                onClick={() => setShowSuccessPopup(false)}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-medium text-center"
              >
                开始聊天
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

