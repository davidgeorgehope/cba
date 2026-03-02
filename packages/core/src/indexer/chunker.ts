import { type SemanticNode, type SupportedLanguage, parseFile, extractSemanticNodes, detectLanguage } from './parser.js';
import { chunkId } from '../utils/hash.js';

export interface CodeChunk {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  chunkType: string;
  symbolName: string;
  parentSymbol?: string;
  language: string;
  tokenEstimate: number;
}

export interface ChunkOptions {
  maxChunkTokens?: number;
  slidingWindowSize?: number;
  slidingWindowOverlap?: number;
}

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_WINDOW_SIZE = 40;
const DEFAULT_WINDOW_OVERLAP = 10;

export async function chunkFile(
  content: string,
  filePath: string,
  extension: string,
  options?: ChunkOptions
): Promise<CodeChunk[]> {
  const maxTokens = options?.maxChunkTokens ?? DEFAULT_MAX_TOKENS;
  const language = detectLanguage(extension);

  if (!language) {
    return slidingWindowChunk(content, filePath, extension, options);
  }

  try {
    const tree = await parseFile(content, language);
    const semanticNodes = extractSemanticNodes(tree, language);

    if (semanticNodes.length === 0) {
      return slidingWindowChunk(content, filePath, extension, options);
    }

    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];

    // Sort by start line
    semanticNodes.sort((a, b) => a.startLine - b.startLine);

    // Capture leading content (imports, top-level code) before first semantic node
    if (semanticNodes.length > 0 && semanticNodes[0]!.startLine > 0) {
      const leadingContent = lines.slice(0, semanticNodes[0]!.startLine).join('\n').trim();
      if (leadingContent.length > 0) {
        chunks.push(createChunk(
          filePath, 0, semanticNodes[0]!.startLine - 1,
          leadingContent, 'imports', 'header', undefined, language
        ));
      }
    }

    for (const node of semanticNodes) {
      const nodeContent = lines.slice(node.startLine, node.endLine + 1).join('\n');
      const tokenEst = estimateTokens(nodeContent);

      if (tokenEst <= maxTokens) {
        chunks.push(createChunk(
          filePath, node.startLine, node.endLine,
          nodeContent, node.type, node.name, node.parentName, language
        ));
      } else {
        // Split large nodes
        const subChunks = splitLargeNode(
          lines, filePath, node, language, maxTokens
        );
        chunks.push(...subChunks);
      }
    }

    // Fill gaps between semantic nodes
    const gapChunks = fillGaps(lines, filePath, semanticNodes, chunks, language, maxTokens);
    chunks.push(...gapChunks);

    // Deduplicate overlapping chunks
    return deduplicateChunks(chunks);
  } catch {
    return slidingWindowChunk(content, filePath, extension, options);
  }
}

function createChunk(
  filePath: string,
  startLine: number,
  endLine: number,
  content: string,
  chunkType: string,
  symbolName: string,
  parentSymbol: string | undefined,
  language: string
): CodeChunk {
  return {
    id: chunkId(filePath, startLine, endLine),
    filePath,
    startLine,
    endLine,
    content,
    chunkType,
    symbolName,
    parentSymbol,
    language,
    tokenEstimate: estimateTokens(content),
  };
}

function splitLargeNode(
  lines: string[],
  filePath: string,
  node: SemanticNode,
  language: string,
  maxTokens: number
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  let start = node.startLine;
  const end = node.endLine;

  while (start <= end) {
    let chunkEnd = start;
    let tokenCount = 0;

    while (chunkEnd <= end) {
      const lineTokens = estimateTokens(lines[chunkEnd] ?? '');
      if (tokenCount + lineTokens > maxTokens && chunkEnd > start) break;
      tokenCount += lineTokens;
      chunkEnd++;
    }
    chunkEnd--;

    const content = lines.slice(start, chunkEnd + 1).join('\n');
    const partNum = chunks.length + 1;
    chunks.push(createChunk(
      filePath, start, chunkEnd,
      content, node.type, `${node.name}[part ${partNum}]`,
      node.parentName, language
    ));

    start = chunkEnd + 1;
  }

  return chunks;
}

function fillGaps(
  lines: string[],
  filePath: string,
  semanticNodes: SemanticNode[],
  existingChunks: CodeChunk[],
  language: string,
  maxTokens: number
): CodeChunk[] {
  const covered = new Set<number>();
  for (const chunk of existingChunks) {
    for (let i = chunk.startLine; i <= chunk.endLine; i++) {
      covered.add(i);
    }
  }

  const gaps: CodeChunk[] = [];
  let gapStart: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (!covered.has(i)) {
      if (gapStart === null) gapStart = i;
    } else if (gapStart !== null) {
      const gapContent = lines.slice(gapStart, i).join('\n').trim();
      if (gapContent.length > 10) {
        gaps.push(createChunk(
          filePath, gapStart, i - 1,
          gapContent, 'code', 'gap', undefined, language
        ));
      }
      gapStart = null;
    }
  }

  // Trailing gap
  if (gapStart !== null) {
    const gapContent = lines.slice(gapStart).join('\n').trim();
    if (gapContent.length > 10) {
      gaps.push(createChunk(
        filePath, gapStart, lines.length - 1,
        gapContent, 'code', 'gap', undefined, language
      ));
    }
  }

  return gaps;
}

function slidingWindowChunk(
  content: string,
  filePath: string,
  extension: string,
  options?: ChunkOptions
): CodeChunk[] {
  const windowSize = options?.slidingWindowSize ?? DEFAULT_WINDOW_SIZE;
  const overlap = options?.slidingWindowOverlap ?? DEFAULT_WINDOW_OVERLAP;
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];
  const lang = extension.replace('.', '');

  for (let start = 0; start < lines.length; start += windowSize - overlap) {
    const end = Math.min(start + windowSize - 1, lines.length - 1);
    const chunkContent = lines.slice(start, end + 1).join('\n');

    if (chunkContent.trim().length > 10) {
      chunks.push(createChunk(
        filePath, start, end,
        chunkContent, 'block', `lines ${start + 1}-${end + 1}`,
        undefined, lang
      ));
    }

    if (end >= lines.length - 1) break;
  }

  return chunks;
}

function deduplicateChunks(chunks: CodeChunk[]): CodeChunk[] {
  // Sort by start line, then by size (larger first)
  chunks.sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine;
    return (b.endLine - b.startLine) - (a.endLine - a.startLine);
  });

  const result: CodeChunk[] = [];
  for (const chunk of chunks) {
    const isContained = result.some(
      existing =>
        existing.filePath === chunk.filePath &&
        existing.startLine <= chunk.startLine &&
        existing.endLine >= chunk.endLine &&
        existing.id !== chunk.id
    );
    if (!isContained) {
      result.push(chunk);
    }
  }

  return result;
}

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for code
  return Math.ceil(text.length / 4);
}
