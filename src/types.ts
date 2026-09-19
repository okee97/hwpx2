export interface RhwpCommandMeta {
  name: string;
  category?: string;
  summary?: string;
  flags?: string[];
  json?: boolean;
  recordFields?: string[];
  batch?: boolean;
}

export interface RhwpCapabilities {
  tool: string;
  version: string;
  schemaVersion?: string;
  commands: RhwpCommandMeta[];
  formats?: {
    read?: string[];
    write?: string[];
  };
  exitCodes?: Record<string, string>;
  [key: string]: unknown;
}

export interface RhwpExecutionResult<T = unknown> {
  command: string[];
  binary?: string;
  exitCode: number | string;
  stdout: string;
  stderr: string;
  durationMs: number;
  success: boolean;
  data: T | null;
  error?: string;
  errorCode?: string;
}

export interface RhwpStatusResponse {
  success: boolean;
  connected: boolean;
  binary: string;
  version?: string | null;
  capabilities?: RhwpCapabilities | null;
  error?: string;
  errorCode?: string;
}

export interface RhwpInfoData {
  format?: string;
  version?: string;
  schemaVersion?: string;
  source?: string;
  sizeBytes?: number;
  pageCount?: number;
  paraCount?: number;
  sections?: number;
  title?: string | null;
  fonts?: string[];
  lastSavedWith?: {
    confidence?: string;
    product?: string;
    version?: string;
  };
  warnings?: string[];
  [key: string]: unknown;
}

export interface TextPage {
  page: number;
  text: string;
}

export interface RhwpTextData {
  schemaVersion?: string;
  source?: string;
  pageCount?: number;
  truncated?: boolean;
  omittedCount?: number;
  pages?: TextPage[];
  [key: string]: unknown;
}

export interface TableCell {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  text: string;
  isHeader?: boolean;
}

export interface RhwpTableItem {
  cellCount: number;
  cells: TableCell[];
  rowCount?: number;
  colCount?: number;
}

export interface RhwpTablesData {
  schemaVersion?: string;
  source?: string;
  tableCount?: number;
  tables?: RhwpTableItem[];
  [key: string]: unknown;
}

export interface StructureNode {
  level?: number;
  title?: string;
  number?: string;
  text?: string;
  paraIndex?: number;
  kind?: string;
  type?: string;
  children?: StructureNode[];
  [key: string]: unknown;
}

export interface RhwpStructureData {
  schemaVersion?: string;
  source?: string;
  mode?: string;
  nodeCount?: number;
  structure?: {
    mode?: string;
    nodeCount?: number;
    roots?: StructureNode[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ParseApiResponse {
  success: boolean;
  connected?: boolean;
  file: {
    name: string;
    format: string;
    size: number;
  };
  rhwp: {
    binary: string;
    version: string | null;
    capabilities: RhwpCapabilities | null;
  };
  info: RhwpInfoData | null;
  text: RhwpTextData | null;
  tables: RhwpTablesData | null;
  structure: RhwpStructureData | null;
  execution: {
    info: RhwpExecutionResult<RhwpInfoData>;
    export_text: RhwpExecutionResult<RhwpTextData>;
    export_tables: RhwpExecutionResult<RhwpTablesData>;
    export_structure: RhwpExecutionResult<RhwpStructureData>;
  };
  error?: string;
}
