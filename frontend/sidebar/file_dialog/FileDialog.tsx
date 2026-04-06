// file: frontend/sidebar/file_dialog/FileDialog.tsx
// Widget for selecting and listing specific file types
import React, { useState } from 'react'; // React, useState
import { File, X } from 'lucide-react'; // File, X

export const FileDialog: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const allowed = ['.pdf', '.txt', '.md', '.PcbDoc'];

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).filter(f => 
      allowed.some(ext => f.name.toLowerCase().endsWith(ext.toLowerCase()))
    );
    setFiles(prev => [...prev, ...newFiles]);
  };

  const remove = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="p-4 flex flex-col gap-4 h-full overflow-hidden">
      <h3 className="text-lg font-semibold text-gray-800">Выбор файлов</h3>
      <label className="flex items-center justify-center p-4 border-2 border-dashed border-blue-400 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
        <span className="text-sm text-blue-600">Нажмите для выбора (.pdf, .txt, .md, .PcbDoc)</span>
        <input type="file" multiple className="hidden" onChange={onSelect} accept=".pdf,.txt,.md,.PcbDoc" />
      </label>
      <div className="flex-1 overflow-y-auto space-y-2">
        {files.map((f, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-white rounded shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 overflow-hidden">
              <File size={16} className="text-gray-400 shrink-0" />
              <span className="text-sm truncate text-gray-700">{f.name}</span>
            </div>
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 transition-colors">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
