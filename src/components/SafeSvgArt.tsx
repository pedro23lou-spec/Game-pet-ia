import React, { useMemo } from 'react';

const ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'title',
]);

const ALLOWED_ATTRS: Record<string, string> = {
  viewbox: 'viewBox',
  xmlns: 'xmlns',
  x: 'x',
  y: 'y',
  x1: 'x1',
  y1: 'y1',
  x2: 'x2',
  y2: 'y2',
  cx: 'cx',
  cy: 'cy',
  r: 'r',
  rx: 'rx',
  ry: 'ry',
  width: 'width',
  height: 'height',
  d: 'd',
  points: 'points',
  fill: 'fill',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  stroke: 'stroke',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-opacity': 'strokeOpacity',
  opacity: 'opacity',
  transform: 'transform',
  id: 'id',
  offset: 'offset',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  gradientunits: 'gradientUnits',
  gradienttransform: 'gradientTransform',
};

function sanitizeAttrValue(attrName: string, value: string): string | null {
  const lower = value.toLowerCase();
  if (lower.includes('javascript:') || lower.includes('expression(')) {
    return null;
  }
  if ((attrName === 'fill' || attrName === 'stroke') && lower.includes('url(')) {
    // Allow internal #id gradient references only
    if (!/^url\(#[-_a-z0-9]+\)$/i.test(value.trim())) {
      return null;
    }
  }
  return value;
}

function convertNode(node: Element, keyPrefix: string): React.ReactNode {
  const tagLower = node.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tagLower)) {
    return null;
  }

  const reactTag =
    tagLower === 'lineargradient'
      ? 'linearGradient'
      : tagLower === 'radialgradient'
        ? 'radialGradient'
        : tagLower;

  const props: Record<string, unknown> = { key: keyPrefix };

  for (let i = 0; i < node.attributes.length; i++) {
    const attr = node.attributes[i];
    const mapped = ALLOWED_ATTRS[attr.name.toLowerCase()];
    if (!mapped) continue;
    const safeVal = sanitizeAttrValue(attr.name.toLowerCase(), attr.value);
    if (safeVal !== null) {
      props[mapped] = safeVal;
    }
  }

  if (reactTag === 'svg') {
    if (!props.viewBox) props.viewBox = '0 0 200 200';
    props.className = 'w-full h-full block';
    props.role = 'img';
    delete props.width;
    delete props.height;
  }

  const children: React.ReactNode[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1) {
      const el = convertNode(child as Element, `${keyPrefix}-${i}`);
      if (el) children.push(el);
    } else if (child.nodeType === 3 && tagLower === 'title') {
      children.push(child.textContent);
    }
  }

  return React.createElement(reactTag, props, ...children);
}

interface SafeSvgArtProps {
  svgMarkup: string;
  altTitle?: string;
}

export const SafeSvgArt: React.FC<SafeSvgArtProps> = ({ svgMarkup, altTitle }) => {
  const renderedSvg = useMemo(() => {
    if (typeof window === 'undefined' || !svgMarkup) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
      const parseErr = doc.querySelector('parsererror');
      const rootEl = parseErr
        ? parser.parseFromString(svgMarkup, 'text/html').querySelector('svg')
        : doc.documentElement;

      if (!rootEl || rootEl.tagName.toLowerCase() !== 'svg') {
        return null;
      }

      return convertNode(rootEl, 'svg-root');
    } catch {
      return null;
    }
  }, [svgMarkup]);

  if (!renderedSvg) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-500 text-xs p-4 text-center">
        {altTitle ?? 'Desenho do pet'}
      </div>
    );
  }

  return <>{renderedSvg}</>;
};
