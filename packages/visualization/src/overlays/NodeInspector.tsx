import React from 'react';
import { useFloating, offset, flip, shift } from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';

export interface NodeData {
  id: string;
  label: string;
  type: string;
  language?: string;
  fanIn?: number;
  fanOut?: number;
}

export interface NodeInspectorProps {
  node: NodeData | null;
  onClose: () => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({ node, onClose }) => {
  const { refs, floatingStyles } = useFloating({
    placement: 'right-start',
    middleware: [offset(20), flip(), shift()],
  });

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          ref={refs.setFloating}
          style={floatingStyles}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="w-[300px] bg-white rounded-lg shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden z-50 absolute top-6 left-6 font-sans">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="m-0 text-sm text-slate-900 font-semibold">{node.type.toUpperCase()}</h3>
              <button 
                onClick={onClose}
                className="bg-transparent border-none cursor-pointer text-slate-500 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4">
              <div className="mb-3">
                <div className="text-xs text-slate-500 mb-1">Name / Path</div>
                <div className="text-sm text-slate-900 break-all font-medium">{node.label}</div>
              </div>

              {node.language && (
                <div className="mb-3">
                  <div className="text-xs text-slate-500 mb-1">Language</div>
                  <div className="text-sm text-slate-900 font-medium">{node.language}</div>
                </div>
              )}

              <div className="flex gap-4 mt-4">
                <div className="flex-1 bg-slate-50 p-2 rounded text-center border border-slate-100">
                  <div className="text-lg font-bold text-blue-500">{node.fanIn || 0}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">Dependents</div>
                </div>
                <div className="flex-1 bg-slate-50 p-2 rounded text-center border border-slate-100">
                  <div className="text-lg font-bold text-amber-500">{node.fanOut || 0}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">Dependencies</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
