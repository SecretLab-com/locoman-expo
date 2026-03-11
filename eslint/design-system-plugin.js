import path from 'node:path';

import { designSystemStyleExceptions } from './design-system-exceptions.js';

const COLOR_LITERAL_PATTERN = /^#(?:[0-9a-f]{3,8})$|^rgba?\(/i;
const exceptionSet = new Set(
  designSystemStyleExceptions.map((filePath) => filePath.replace(/\\/g, '/')),
);

const STYLE_LITERAL_KEYS = new Set([
  'fontSize',
  'fontWeight',
  'shadowColor',
  'shadowOpacity',
  'shadowOffset',
  'shadowRadius',
  'elevation',
  'boxShadow',
]);

function getPropertyName(node) {
  if (!node || node.type !== 'Property') return null;
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal') return String(node.key.value);
  return null;
}

function isStaticTemplateLiteral(node) {
  return node.type === 'TemplateLiteral' && node.expressions.length === 0;
}

function isColorLiteralNode(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return COLOR_LITERAL_PATTERN.test(node.value.trim());
  }
  if (isStaticTemplateLiteral(node)) {
    const cooked = node.quasis[0]?.value?.cooked || '';
    return COLOR_LITERAL_PATTERN.test(cooked.trim());
  }
  return false;
}

function isStyleLiteralNode(node) {
  if (node.type === 'Literal') {
    return typeof node.value === 'string' || typeof node.value === 'number';
  }
  if (isStaticTemplateLiteral(node)) return true;
  if (node.type === 'ObjectExpression') return true;
  return false;
}

const noRawDesignValuesRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw design-system values in UI files. Use named tokens, helpers, or primitives instead.',
    },
    schema: [],
    messages: {
      rawColor:
        'Raw color literal detected. Use a named design-system token, helper, or primitive instead.',
      rawStyle:
        'Raw style literal detected for {{key}}. Use a named design-system token, typography scale, or elevation recipe instead.',
    },
  },
  create(context) {
    const relativeFilename = path.relative(process.cwd(), context.filename).replace(/\\/g, '/');
    if (exceptionSet.has(relativeFilename)) {
      return {};
    }
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (!COLOR_LITERAL_PATTERN.test(node.value.trim())) return;
        context.report({ node, messageId: 'rawColor' });
      },
      TemplateLiteral(node) {
        if (!isStaticTemplateLiteral(node)) return;
        const cooked = node.quasis[0]?.value?.cooked || '';
        if (!COLOR_LITERAL_PATTERN.test(cooked.trim())) return;
        context.report({ node, messageId: 'rawColor' });
      },
      Property(node) {
        const key = getPropertyName(node);
        if (!key || !STYLE_LITERAL_KEYS.has(key)) return;
        if (!isStyleLiteralNode(node.value)) return;
        context.report({
          node: node.value,
          messageId: 'rawStyle',
          data: { key },
        });
      },
    };
  },
};

export default {
  rules: {
    'no-raw-design-values': noRawDesignValuesRule,
  },
};
