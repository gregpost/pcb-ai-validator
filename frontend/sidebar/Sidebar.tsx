// file: frontend/sidebar/Sidebar.tsx
// Main sidebar widget with collapse logic and widget slots
import React, { useState } from 'react'; // React, useState
import { X, ChevronRight } from 'lucide-react'; // X, ChevronRight
import { FileDialog } from './file_dialog/FileDialog'; // FileDialog
import { cn } from '../../src/lib/utils'; // cn

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={cn(
      "fixed top-0 left-0 h-full bg-gray-50 border-r border-gray-200 transition-all duration-300 z-50",
      isCollapsed ? "w-0 -translate-x-full" : "w-full sm:w-80 translate-x-0"
    )}>
      {!isCollapsed && (
        <div className="relative h-full flex flex-col">
          <button 
            onClick={() => setIsCollapsed(true)}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
          <div className="flex-1 overflow-hidden pt-12">
            <FileDialog />
          </div>
        </div>
      )}
      {isCollapsed && (
        <button 
          onClick={() => setIsCollapsed(false)}
          className="fixed top-4 left-4 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all"
          aria-label="Open sidebar"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
};
