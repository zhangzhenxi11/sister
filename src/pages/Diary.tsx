import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Calendar, Clock, Trash2, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDiaryStore, type DiaryEntry } from '@/stores/diaryStore';
import { v4 as uuidv4 } from 'uuid';

const moodEmojis: Record<DiaryEntry['mood'], string> = {
  happy: '😊',
  sad: '😢',
  anxious: '😰',
  excited: '🤩',
  calm: '😌',
  confused: '😕',
};

const moodColors: Record<DiaryEntry['mood'], string> = {
  happy: 'bg-yellow-100 text-yellow-700',
  sad: 'bg-blue-100 text-blue-700',
  anxious: 'bg-red-100 text-red-700',
  excited: 'bg-orange-100 text-orange-700',
  calm: 'bg-green-100 text-green-700',
  confused: 'bg-purple-100 text-purple-700',
};

export default function Diary() {
  const navigate = useNavigate();
  const { diaries, addDiary, deleteDiary } = useDiaryStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showEditor, setShowEditor] = useState(false);
  const [mood, setMood] = useState<DiaryEntry['mood']>('happy');
  const [content, setContent] = useState('');

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handleSave = () => {
    if (!content.trim()) return;

    const diary: DiaryEntry = {
      id: uuidv4(),
      mood,
      content,
      date: selectedDate.toISOString().split('T')[0],
      createdAt: new Date(),
    };

    addDiary(diary);
    setShowEditor(false);
    setContent('');
  };

  const selectedDiary = diaries.find(d => d.date === selectedDate.toISOString().split('T')[0]);

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const diary = diaries.find(d => d.date === dateStr);
      const isSelected = selectedDate.toISOString().split('T')[0] === dateStr;

      days.push(
        <button
          key={day}
          onClick={() => setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
          className={`h-10 rounded-lg flex items-center justify-center text-sm relative ${
            isSelected ? 'bg-pink-500 text-white' : 'hover:bg-gray-100'
          }`}
        >
          {day}
          {diary && (
            <span className="absolute -bottom-1 text-xs">
              {moodEmojis[diary.mood]}
            </span>
          )}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="font-semibold text-gray-800">心情日记</h1>
        </div>
        <button
          onClick={() => setShowEditor(true)}
          className="p-2 bg-pink-500 text-white rounded-full"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      <div className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="font-semibold text-gray-800">
              {currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月
            </h2>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['日', '一', '二', '三', '四', '五', '六'].map(day => (
              <div key={day} className="text-xs text-gray-500 py-1">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {renderCalendar()}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-4">
          <h3 className="font-semibold text-gray-800 mb-3">
            {selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
          </h3>

          {selectedDiary ? (
            <div className="space-y-3">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${moodColors[selectedDiary.mood]}`}>
                <span className="text-lg">{moodEmojis[selectedDiary.mood]}</span>
                <span className="text-sm font-medium">
                  {selectedDiary.mood === 'happy' && '开心'}
                  {selectedDiary.mood === 'sad' && '难过'}
                  {selectedDiary.mood === 'anxious' && '焦虑'}
                  {selectedDiary.mood === 'excited' && '兴奋'}
                  {selectedDiary.mood === 'calm' && '平静'}
                  {selectedDiary.mood === 'confused' && '困惑'}
                </span>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{selectedDiary.content}</p>
              <button
                onClick={() => deleteDiary(selectedDiary.id)}
                className="text-red-500 text-sm flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> 删除
              </button>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">暂无日记</p>
          )}
        </div>
      </div>

      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">写日记</h3>
              <button onClick={() => setShowEditor(false)} className="text-gray-400">取消</button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">今天心情如何？</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(moodEmojis) as DiaryEntry['mood'][]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMood(m)}
                    className={`px-4 py-2 rounded-full flex items-center gap-2 ${
                      mood === m ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span>{moodEmojis[m]}</span>
                    <span className="text-sm">
                      {m === 'happy' && '开心'}
                      {m === 'sad' && '难过'}
                      {m === 'anxious' && '焦虑'}
                      {m === 'excited' && '兴奋'}
                      {m === 'calm' && '平静'}
                      {m === 'confused' && '困惑'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="记录今天的心情..."
              className="w-full h-32 bg-gray-100 rounded-xl p-4 text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-pink-300"
            />

            <button
              onClick={handleSave}
              disabled={!content.trim()}
              className="w-full mt-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-xl font-medium disabled:opacity-50"
            >
              保存日记
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
