import Parser, { SyntaxNode } from "tree-sitter";
import Cpp from "tree-sitter-cpp";
import type { ChunkElement, SourceRange } from "../shared/types.js";

const parser = new Parser();
parser.setLanguage(Cpp as Parser.Language);

const namedSymbolTypes = new Set([
  "identifier",
  "field_identifier",
  "operator_name",
  "type_identifier",
  "destructor_name"
]);

export function resolveDisplayRange(source: string, element: ChunkElement): SourceRange {
  const tree = parser.parse(source);
  const simpleName = element.symbol.split("::").at(-1) ?? element.symbol;
  const containerTypes = element.kind === "function"
    ? new Set(["function_definition"])
    : element.kind === "field"
      ? new Set(["field_declaration"])
    : element.kind === "enum"
      ? new Set(["enum_specifier"])
      : new Set(["class_specifier", "struct_specifier"]);

  const container = findNamedContainer(tree.rootNode, simpleName, containerTypes);
  if (container) {
    return {
      startLine: container.startPosition.row + 1,
      endLine: container.endPosition.row + 1
    };
  }

  const focus = element.focus ?? [];
  if (focus.length > 0) {
    return {
      startLine: Math.min(...focus.map((range) => range.startLine)),
      endLine: Math.max(...focus.map((range) => range.endLine))
    };
  }

  return { startLine: 1, endLine: source.split("\n").length };
}

function findNamedContainer(
  root: SyntaxNode,
  simpleName: string,
  containerTypes: ReadonlySet<string>
): SyntaxNode | undefined {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (containerTypes.has(node.type) && containerMatches(node, simpleName)) {
      return node;
    }
    stack.push(...node.namedChildren);
  }
  return undefined;
}

function containerMatches(container: SyntaxNode, simpleName: string): boolean {
  const nameRoot = container.type === "function_definition" || container.type === "field_declaration"
    ? container.childForFieldName("declarator")
    : container.childForFieldName("name");
  if (!nameRoot) return false;

  const stack = [nameRoot];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (namedSymbolTypes.has(node.type) && node.text === simpleName) {
      return true;
    }
    stack.push(...node.namedChildren);
  }
  return false;
}
