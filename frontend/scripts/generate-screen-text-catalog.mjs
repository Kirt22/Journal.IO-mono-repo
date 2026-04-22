import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const projectRoot = path.resolve(import.meta.dirname, "..");
const screensRoot = path.join(projectRoot, "src", "screens");
const outputFile = path.join(projectRoot, "src", "content", "screenTextCatalog.ts");

const TEXT_PROPS = new Set([
  "accessibilityHint",
  "accessibilityLabel",
  "badge",
  "body",
  "buttonLabel",
  "description",
  "footer",
  "helperText",
  "label",
  "message",
  "placeholder",
  "subtitle",
  "text",
  "title",
]);

const TEXT_OBJECT_KEYS = new Set([
  "badge",
  "body",
  "buttonLabel",
  "confirmPassword",
  "cta",
  "description",
  "email",
  "footer",
  "form",
  "helperText",
  "highlight",
  "label",
  "message",
  "password",
  "placeholder",
  "subtitle",
  "text",
  "title",
]);

const ERROR_SETTERS = new Set([
  "setAnalysisError",
  "setError",
]);

const UI_TEXT_PATTERN =
  /[\s.!?,'"()&/@]|\.{3}|[A-Z]|[\u{1F300}-\u{1FAFF}]/u;

const normalizeText = text => text.replace(/\s+/g, " ").trim();

const isImportContext = parent =>
  ts.isImportDeclaration(parent) ||
  ts.isExportDeclaration(parent) ||
  ts.isImportSpecifier(parent) ||
  ts.isExportSpecifier(parent);

const isRequireCall = parent =>
  ts.isCallExpression(parent) &&
  ts.isIdentifier(parent.expression) &&
  parent.expression.text === "require";

const isConsoleCall = parent =>
  ts.isCallExpression(parent) &&
  ts.isPropertyAccessExpression(parent.expression) &&
  ts.isIdentifier(parent.expression.expression) &&
  parent.expression.expression.text === "console";

const shouldIgnoreLooseText = text => {
  if (!text) {
    return true;
  }

  if (/^#(?:[0-9a-f]{3,8})$/i.test(text)) {
    return true;
  }

  if (/^\.{1,2}\//.test(text)) {
    return true;
  }

  if (/^(ios|android|cover|contain|photo|email|profile|button|cancel|destructive|en-US)$/i.test(text)) {
    return true;
  }

  if (
    text.startsWith("[") ||
    /^rgba\(/i.test(text) ||
    /^[0-9]+$/.test(text) ||
    /^[MLAZHVCSQT]$/i.test(text) ||
    /^quick-thought-\$\{.*\}$/.test(text) ||
    /^\$\{[^}]+\}$/.test(text) ||
    /^[MLAZHVCSQT][- 0-9.${},]+$/i.test(text) ||
    /^[a-z]+[A-Z][A-Za-z0-9]*$/.test(text) ||
    text.includes("Date.now()") ||
    text.includes("escapeRegex") ||
    text.includes("\\$&")
  ) {
    return true;
  }

  if (/^[a-z0-9_.:/-]+$/i.test(text) && !UI_TEXT_PATTERN.test(text)) {
    return true;
  }

  return false;
};

const getStringNodeText = (node, sourceFile) => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isTemplateExpression(node)) {
    return node.getText(sourceFile).slice(1, -1);
  }

  if (ts.isJsxText(node)) {
    return node.getText(sourceFile);
  }

  return null;
};

const addText = (bucket, seen, rawText) => {
  const normalized = normalizeText(rawText);

  if (!normalized || /^[0-9]+$/.test(normalized) || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  bucket.push(normalized);
};

const isInsideTextElement = node => {
  let currentNode = node.parent;

  while (currentNode) {
    if (ts.isJsxElement(currentNode)) {
      return currentNode.openingElement.tagName.getText() === "Text";
    }

    if (ts.isJsxSelfClosingElement(currentNode)) {
      return currentNode.tagName.getText() === "Text";
    }

    currentNode = currentNode.parent;
  }

  return false;
};

const collectStringLikes = (node, sourceFile, bucket, seen) => {
  const visit = currentNode => {
    if (ts.isStringLiteral(currentNode) || ts.isNoSubstitutionTemplateLiteral(currentNode)) {
      addText(bucket, seen, currentNode.text);
      return;
    }

    if (ts.isTemplateExpression(currentNode)) {
      addText(bucket, seen, currentNode.getText(sourceFile).slice(1, -1));
      return;
    }

    if (ts.isJsxText(currentNode)) {
      addText(bucket, seen, currentNode.getText(sourceFile));
      return;
    }

    ts.forEachChild(currentNode, visit);
  };

  visit(node);
};

const collectScreenText = (sourceFile, filePath) => {
  const bucket = [];
  const seen = new Set();

  const visit = node => {
    if (ts.isJsxText(node)) {
      addText(bucket, seen, node.getText(sourceFile));
      return;
    }

    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.parent
    ) {
      if (isImportContext(node.parent) || isRequireCall(node.parent)) {
        return;
      }

      if (isConsoleCall(node.parent)) {
        return;
      }

      if (
        shouldIgnoreLooseText(node.text) ||
        (ts.isJsxAttribute(node.parent) && !TEXT_PROPS.has(node.parent.name.text))
      ) {
        return;
      }

      if (UI_TEXT_PATTERN.test(node.text)) {
        addText(bucket, seen, node.text);
        return;
      }
    }

    if (ts.isJsxAttribute(node) && TEXT_PROPS.has(node.name.text) && node.initializer) {
      collectStringLikes(node.initializer, sourceFile, bucket, seen);
      return;
    }

    if (ts.isJsxExpression(node) && node.expression && isInsideTextElement(node)) {
      collectStringLikes(node.expression, sourceFile, bucket, seen);
      return;
    }

    if (ts.isPropertyAssignment(node)) {
      const propertyName = ts.isIdentifier(node.name)
        ? node.name.text
        : ts.isStringLiteral(node.name)
          ? node.name.text
          : null;

      if (propertyName && TEXT_OBJECT_KEYS.has(propertyName)) {
        collectStringLikes(node.initializer, sourceFile, bucket, seen);
        return;
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Alert" &&
      node.expression.name.text === "alert"
    ) {
      node.arguments.forEach(argument =>
        collectStringLikes(argument, sourceFile, bucket, seen)
      );
      return;
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (ERROR_SETTERS.has(node.expression.text)) {
        node.arguments.forEach(argument =>
          collectStringLikes(argument, sourceFile, bucket, seen)
        );
        return;
      }
    }

    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Error" &&
      node.arguments
    ) {
      node.arguments.forEach(argument =>
        collectStringLikes(argument, sourceFile, bucket, seen)
      );
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!bucket.length) {
    console.warn(`[screen-text-catalog] No text extracted from ${filePath}`);
  }

  return bucket;
};

const listScreenFiles = async directory => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const resolved = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listScreenFiles(resolved);
      }

      if (/\.(tsx|ts)$/.test(entry.name)) {
        return [resolved];
      }

      return [];
    })
  );

  return files.flat().sort();
};

const buildCatalogSource = catalog => {
  const lines = [
    "// Generated by frontend/scripts/generate-screen-text-catalog.mjs",
    "// This file centralizes screen copy inventory for future localization work.",
    "",
    "export const screenTextCatalog = {",
  ];

  for (const [screenPath, texts] of Object.entries(catalog)) {
    lines.push(`  ${JSON.stringify(screenPath)}: [`);

    for (const text of texts) {
      lines.push(`    ${JSON.stringify(text)},`);
    }

    lines.push("  ],");
  }

  lines.push("} as const;");
  lines.push("");

  return `${lines.join("\n")}`;
};

const main = async () => {
  const screenFiles = await listScreenFiles(screensRoot);
  const catalog = {};

  for (const filePath of screenFiles) {
    const relativeScreenPath = path.relative(screensRoot, filePath).replaceAll(path.sep, "/");
    const fileSource = await fs.readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      fileSource,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    catalog[relativeScreenPath] = collectScreenText(sourceFile, relativeScreenPath);
  }

  await fs.writeFile(outputFile, buildCatalogSource(catalog));
  console.log(`[screen-text-catalog] Wrote ${outputFile}`);
};

main().catch(error => {
  console.error("[screen-text-catalog] Failed to build screen text catalog.");
  console.error(error);
  process.exitCode = 1;
});
