import Parser, { type SyntaxNode, type Tree } from 'tree-sitter';
import { ParserError } from '../utils/errors.js';

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java';

const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
};

const languageCache = new Map<SupportedLanguage, unknown>();

async function loadLanguage(lang: SupportedLanguage): Promise<unknown> {
  const cached = languageCache.get(lang);
  if (cached) return cached;

  let grammar: unknown;
  try {
    switch (lang) {
      case 'typescript': {
        const mod = await import('tree-sitter-typescript');
        grammar = (mod as { default?: { typescript: unknown }; typescript?: unknown }).default?.typescript ?? (mod as { typescript: unknown }).typescript;
        break;
      }
      case 'javascript': {
        const mod = await import('tree-sitter-javascript');
        grammar = (mod as { default?: unknown }).default ?? mod;
        break;
      }
      case 'python': {
        const mod = await import('tree-sitter-python');
        grammar = (mod as { default?: unknown }).default ?? mod;
        break;
      }
      case 'go': {
        const mod = await import('tree-sitter-go');
        grammar = (mod as { default?: unknown }).default ?? mod;
        break;
      }
      case 'rust': {
        const mod = await import('tree-sitter-rust');
        grammar = (mod as { default?: unknown }).default ?? mod;
        break;
      }
      case 'java': {
        const mod = await import('tree-sitter-java');
        grammar = (mod as { default?: unknown }).default ?? mod;
        break;
      }
    }
  } catch (err) {
    throw new ParserError(`Failed to load tree-sitter grammar for ${lang}`, err);
  }

  languageCache.set(lang, grammar);
  return grammar;
}

export function detectLanguage(extension: string): SupportedLanguage | null {
  return EXTENSION_TO_LANGUAGE[extension.toLowerCase()] ?? null;
}

export async function parseFile(
  content: string,
  language: SupportedLanguage
): Promise<Tree> {
  const parser = new Parser();
  const grammar = await loadLanguage(language);
  parser.setLanguage(grammar as Parameters<typeof parser.setLanguage>[0]);
  return parser.parse(content);
}

export interface SemanticNode {
  type: string;
  name: string;
  startLine: number;
  endLine: number;
  parentName?: string;
  node: SyntaxNode;
}

export function extractSemanticNodes(
  tree: Tree,
  language: SupportedLanguage
): SemanticNode[] {
  const nodes: SemanticNode[] = [];
  const extractors = getExtractors(language);
  walkTree(tree.rootNode, extractors, nodes);
  return nodes;
}

type NodeExtractor = (node: SyntaxNode, parent?: SyntaxNode) => SemanticNode | null;

function getExtractors(language: SupportedLanguage): NodeExtractor[] {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return [extractTSNode];
    case 'python':
      return [extractPythonNode];
    case 'go':
      return [extractGoNode];
    case 'rust':
      return [extractRustNode];
    case 'java':
      return [extractJavaNode];
  }
}

function walkTree(
  node: SyntaxNode,
  extractors: NodeExtractor[],
  results: SemanticNode[],
  parent?: SyntaxNode
): void {
  for (const extractor of extractors) {
    const result = extractor(node, parent);
    if (result) {
      results.push(result);
    }
  }
  for (const child of node.children) {
    walkTree(child, extractors, results, node);
  }
}

function getNodeName(node: SyntaxNode): string {
  const nameNode = node.childForFieldName('name');
  return nameNode?.text ?? '<anonymous>';
}

function getParentName(parent?: SyntaxNode): string | undefined {
  if (!parent) return undefined;
  const nameNode = parent.childForFieldName('name');
  return nameNode?.text;
}

const TS_SEMANTIC_TYPES = new Set([
  'function_declaration', 'arrow_function', 'function',
  'method_definition',
  'class_declaration', 'class',
  'interface_declaration',
  'type_alias_declaration',
  'enum_declaration',
  'export_statement',
  'lexical_declaration',
]);

function extractTSNode(node: SyntaxNode, parent?: SyntaxNode): SemanticNode | null {
  if (!TS_SEMANTIC_TYPES.has(node.type)) return null;

  // Skip small lexical declarations (single-line const/let)
  if (node.type === 'lexical_declaration' && node.endPosition.row - node.startPosition.row < 3) {
    return null;
  }

  // For export statements, get the inner declaration
  if (node.type === 'export_statement') {
    const declaration = node.childForFieldName('declaration');
    if (declaration && TS_SEMANTIC_TYPES.has(declaration.type)) {
      return null; // Will be captured by the inner declaration
    }
  }

  return {
    type: mapNodeType(node.type),
    name: getNodeName(node),
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
    parentName: getParentName(parent),
    node,
  };
}

function extractPythonNode(node: SyntaxNode, parent?: SyntaxNode): SemanticNode | null {
  if (node.type !== 'function_definition' && node.type !== 'class_definition') return null;
  return {
    type: node.type === 'class_definition' ? 'class' : 'function',
    name: getNodeName(node),
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
    parentName: getParentName(parent),
    node,
  };
}

function extractGoNode(node: SyntaxNode, parent?: SyntaxNode): SemanticNode | null {
  const types = new Set(['function_declaration', 'method_declaration', 'type_declaration']);
  if (!types.has(node.type)) return null;
  return {
    type: mapNodeType(node.type),
    name: getNodeName(node),
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
    parentName: getParentName(parent),
    node,
  };
}

function extractRustNode(node: SyntaxNode, parent?: SyntaxNode): SemanticNode | null {
  const types = new Set([
    'function_item', 'impl_item', 'struct_item', 'enum_item',
    'trait_item', 'type_item',
  ]);
  if (!types.has(node.type)) return null;
  return {
    type: mapNodeType(node.type),
    name: getNodeName(node),
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
    parentName: getParentName(parent),
    node,
  };
}

function extractJavaNode(node: SyntaxNode, parent?: SyntaxNode): SemanticNode | null {
  const types = new Set([
    'method_declaration', 'class_declaration', 'interface_declaration',
    'enum_declaration', 'constructor_declaration',
  ]);
  if (!types.has(node.type)) return null;
  return {
    type: mapNodeType(node.type),
    name: getNodeName(node),
    startLine: node.startPosition.row,
    endLine: node.endPosition.row,
    parentName: getParentName(parent),
    node,
  };
}

function mapNodeType(type: string): string {
  const mapping: Record<string, string> = {
    function_declaration: 'function',
    arrow_function: 'function',
    function: 'function',
    method_definition: 'method',
    method_declaration: 'method',
    class_declaration: 'class',
    class: 'class',
    interface_declaration: 'interface',
    type_alias_declaration: 'type',
    enum_declaration: 'enum',
    lexical_declaration: 'variable',
    export_statement: 'export',
    type_declaration: 'type',
    function_item: 'function',
    impl_item: 'impl',
    struct_item: 'struct',
    enum_item: 'enum',
    trait_item: 'trait',
    type_item: 'type',
    constructor_declaration: 'constructor',
  };
  return mapping[type] ?? type;
}
