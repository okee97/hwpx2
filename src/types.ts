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
  heading?: string;
  marker?: string;
  number?: string;
  text?: string;
  paraIndex?: number;
  paragraph?: number;
  section?: number;
  kind?: string;
  type?: string;
  body?: string[];
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

export interface CanonicalPage {
  page: number; // rhwp 기준 0-based
  display_page: number; // 화면 표시용 1-based
  text: string;
  char_count: number;
}

export interface CanonicalTableCell {
  row: number;
  col: number;
  row_span: number;
  col_span: number;
  is_header: boolean;
  text: string;
  nested?: CanonicalTable[];
}

export interface CanonicalTable {
  id: string;
  index: number;
  source_locator: {
    section: number | null;
    paragraph: number | null;
  };
  caption: string | null;
  rows: number;
  cols: number;
  cell_count: number;
  cells: CanonicalTableCell[];
}

export interface CanonicalOutlineNode {
  id: string;
  level: number;
  title: string;
  heading?: string;
  marker?: string | null;
  kind?: string | null;
  number?: string | null;
  para_index?: number | null;
  section?: number | null;
  body?: string[];
  children?: CanonicalOutlineNode[];
  [key: string]: unknown;
}

export interface CanonicalDocumentStats {
  page_count: number;
  total_char_count: number;
  table_count: number;
  total_cell_count: number;
  merged_cell_count: number;
  nested_table_count: number;
  outline_node_count: number;
  truncated: boolean;
  omitted_count: number;
  markdown_char_count: number;
}

export interface CanonicalQualityReport {
  text: {
    page_count: number;
    char_count: number;
    truncated: boolean;
    omitted_count: number;
  };
  tables: {
    table_count: number;
    cell_count: number;
    merged_cell_count: number;
    nested_table_count: number;
  };
  structure: {
    node_count: number;
  };
  canonical: {
    markdown_char_count: number;
    warnings: string[];
  };
}

export interface CanonicalDocument {
  schema_version: "1.0";
  source: {
    file_name: string;
    format: "hwp" | "hwpx";
    size: number;
    rhwp_version: string;
  };
  metadata: {
    page_count: number | null;
    paragraph_count: number | null;
    section_count: number | null;
    title: string | null;
  };
  pages: CanonicalPage[];
  tables: CanonicalTable[];
  outline: CanonicalOutlineNode[];
  stats: CanonicalDocumentStats;
  warnings: string[];
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
  canonical?: CanonicalDocument | null;
  canonical_markdown?: string | null;
  markdown?: string | null;
  quality?: CanonicalQualityReport | null;
  error?: string;
}

export type ProjectType =
  | "SERVICE"
  | "GOODS"
  | "CONSTRUCTION"
  | "RESEARCH"
  | "IT"
  | "OTHER"
  | "UNKNOWN";

export type CompetitionMethod =
  | "OPEN_COMPETITIVE"
  | "RESTRICTED_COMPETITIVE"
  | "NOMINATED_COMPETITIVE"
  | "PRIVATE_CONTRACT"
  | "UNKNOWN";

export type AwardMethod =
  | "NEGOTIATION"
  | "QUALIFICATION_REVIEW"
  | "LOWEST_PRICE"
  | "TWO_STAGE"
  | "SPEC_PRICE_SIMULTANEOUS"
  | "OTHER"
  | "UNKNOWN";

export interface MetadataEvidence {
  field: string;
  source:
    | {
        type: "PAGE";
        page: number;
      }
    | {
        type: "TABLE";
        table_id: string;
      };
  quote: string;
  status: "EXPLICIT" | "INFERRED" | "NOT_FOUND";
}

export interface BusinessMetadata {
  project_name: string | null;
  ordering_agency: string | null;
  procurement_agency: string | null;
  project_type: ProjectType;
  project_period: {
    raw: string | null;
  };
  budget: {
    amount: number | null;
    currency: "KRW" | null;
    vat_included: boolean | null;
  };
  competition_method: CompetitionMethod;
  award_method: AwardMethod;
  evaluation: {
    technical_score: number | null;
    price_score: number | null;
  };
  participation: {
    business_type: string | null;
    business_code: string | null;
    sme_restriction: string | null;
    joint_contract_allowed: boolean | null;
    subcontract_allowed: boolean | null;
  };
  governing_law: string | null;
  summary: string | null;
  evidence: MetadataEvidence[];
}

export interface ExtractMetadataRequest {
  canonical_markdown?: string;
  document_id?: string;
}

export interface ExtractMetadataResponse {
  success: boolean;
  model?: string;
  metadata?: BusinessMetadata;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  duration_ms?: number;
  error?: string;
  error_code?:
    | "AI_REQUEST_FAILED"
    | "DOCUMENT_TOO_LARGE"
    | "MISSING_API_KEY"
    | "INVALID_INPUT"
    | "JSON_PARSE_ERROR";
}
