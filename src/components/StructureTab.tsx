import React, { useState } from "react";
import { Network, FolderTree, ChevronRight, ChevronDown, Hash, ListTree, AlertCircle } from "lucide-react";
import { RhwpStructureData, StructureNode } from "../types";

interface StructureTabProps {
  structureData: RhwpStructureData | null;
}

const TreeNodeItem: React.FC<{ node: StructureNode; defaultExpanded: boolean }> = ({
  node,
  defaultExpanded,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasChildren = Boolean(node.children && node.children.length > 0);
  const title = node.title || node.text || node.number || "(제목 없음)";
  const level = node.level ?? 0;

  return (
    <div className="text-xs">
      <div
        className={`flex items-start gap-2 py-1.5 px-2.5 rounded-lg transition-colors hover:bg-stone-100 ${
          hasChildren ? "cursor-pointer font-medium" : "text-stone-700"
        }`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <div className="pt-0.5 w-4 h-4 shrink-0 flex items-center justify-center text-stone-500">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {node.level !== undefined && (
            <span className="px-1.5 py-0.2 rounded bg-stone-200 text-stone-700 font-mono text-[10px]">
              L{level}
            </span>
          )}

          {node.number && (
            <span className="font-mono font-semibold text-amber-900 bg-amber-100/70 px-1.5 py-0.2 rounded text-[11px]">
              {node.number}
            </span>
          )}

          <span className="text-stone-900 leading-normal break-words">{title}</span>

          {node.paraIndex !== undefined && (
            <span className="text-[10px] text-stone-400 font-mono">
              (para #{node.paraIndex})
            </span>
          )}
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="pl-6 border-l border-stone-200 ml-4 space-y-0.5 mt-0.5">
          {node.children!.map((child, idx) => (
            <TreeNodeItem key={idx} node={child} defaultExpanded={defaultExpanded} />
          ))}
        </div>
      )}
    </div>
  );
};

export const StructureTab: React.FC<StructureTabProps> = ({ structureData }) => {
  const [expandAll, setExpandAll] = useState(true);

  if (!structureData) {
    return (
      <div className="p-12 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
        <Network className="w-10 h-10 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-stone-800 mb-1">
          구조 데이터가 없습니다
        </h3>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          rhwp export-structure 명령이 실행되지 않았거나 결과가 비어 있습니다.
        </p>
      </div>
    );
  }

  const structureObj = structureData.structure || {};
  const roots = structureObj.roots || [];
  const mode = structureData.mode || structureObj.mode || "auto";
  const nodeCount = structureData.nodeCount ?? structureObj.nodeCount ?? roots.length;

  return (
    <div className="space-y-4">
      {/* Top Meta Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-stone-700">
            <FolderTree className="w-4 h-4 text-stone-500" />
            <span className="font-semibold">문서 구조 분석 방식:</span>
            <span className="px-2 py-0.5 rounded bg-stone-100 border border-stone-200 font-mono text-stone-800 uppercase">
              {mode}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-stone-600 bg-stone-50 border border-stone-200 px-2.5 py-1 rounded-md font-mono">
            <span>추출 노드 수: <strong className="text-stone-900">{nodeCount}</strong>개</span>
            <span className="text-stone-300">•</span>
            <span>최상위 루트: <strong className="text-stone-900">{roots.length}</strong>개</span>
          </div>
        </div>

        {roots.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandAll(!expandAll)}
            className="text-xs px-2.5 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors cursor-pointer"
          >
            {expandAll ? "모두 접기" : "모두 펼치기"}
          </button>
        )}
      </div>

      {/* Tree Content */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-5">
        {roots.length === 0 ? (
          <div className="py-8 text-center text-stone-500">
            <ListTree className="w-8 h-8 text-stone-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-800">
              추출된 개요/조문 구조 노드가 없습니다 (nodeCount: 0)
            </p>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
              원본 문서에 개요 번호나 조문 계층(편·장·절·조·항)이 포함되어 있지 않거나 구조 정보가 존재하지 않습니다.
              <br />
              <strong className="text-stone-700">원칙 준수:</strong> 원본 구조 정보가 없으므로 임의의 가짜 트리를 생성하지 않고 원본 그대로 표시합니다.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {roots.map((rootNode, idx) => (
              <TreeNodeItem
                key={`${idx}-${expandAll}`}
                node={rootNode}
                defaultExpanded={expandAll}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
