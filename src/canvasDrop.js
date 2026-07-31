// Where a canvas drop lands, given what the preview reported under the
// pointer and what the page model says about it.
//
// The iframe reports geometry only — it has no model and no markup rules. The
// decision is here so both halves stay honest: "which element" is a question
// about pixels, "may it hold this, and where" is a question about the tree.

import { canContainTag } from './elementSchemas.js';

// Kinds that can take children at all. Mirrors the navigator's own rule so a
// canvas drop and a tree drop accept the same places.
const CAN_HOST = new Set(['element', 'component', 'chunk-group', 'map']);

// How deep the before/after zones reach into an element. Proportional so a
// tall section still has a usable middle, capped so a short row doesn't end
// up as two edges and no inside.
export const EDGE_RATIO = 0.3;
export const EDGE_MAX = 14;

export function edgeSize(height) {
  return Math.min(height * EDGE_RATIO, EDGE_MAX);
}

// 'before' | 'after' | 'inside'. An element that can't hold children has no
// middle — the whole box splits at the halfway line.
export function positionFor(rect, pointerY, canHoldChildren) {
  const edge = edgeSize(rect.h);
  if (!canHoldChildren) return pointerY < rect.y + rect.h / 2 ? 'before' : 'after';
  if (pointerY < rect.y + edge) return 'before';
  if (pointerY > rect.y + rect.h - edge) return 'after';
  return 'inside';
}

// The dragged thing's tag, when it has one. Components render markup we can't
// see, so they're never blocked on content model.
function draggedTag(drag) {
  if (!drag) return null;
  return drag.kind === 'element' || drag.nodeKind === 'element' ? drag.tag || null : null;
}

// Whether `parent` may hold what's being dragged.
function accepts(parent, drag) {
  if (!parent) return true; // page root takes anything
  if (!CAN_HOST.has(parent.kind)) return false;
  const tag = draggedTag(drag);
  if (!tag || parent.kind !== 'element') return true;
  return canContainTag(parent.name, tag);
}

/**
 * Resolve a reported hover into an insertion target.
 *
 * `hit` is the iframe's `{path, rect, pointer}`; `lookup(pathArray)` returns
 * the model node at an index path. Returns null when there's nothing legal
 * under the pointer, so the caller draws no line and refuses the drop.
 */
export function resolveDrop(hit, drag, lookup) {
  if (!hit?.path) return null;
  const trail = hit.path.split('.').map(Number);
  if (trail.some(Number.isNaN)) return null;
  const node = lookup(trail);
  if (!node) return null;

  const canHost = CAN_HOST.has(node.kind) && accepts(node, drag);
  let position = positionFor(hit.rect, hit.pointer.y, canHost);

  if (position === 'inside') {
    return {
      position,
      rect: hit.rect,
      target: { parentId: node.id, index: node.children?.length ?? 0 },
    };
  }

  // Sibling drop: the parent is one level up the index path, and the page
  // root (an empty trail) is a legal parent with a null id.
  const parentTrail = trail.slice(0, -1);
  const parent = parentTrail.length ? lookup(parentTrail) : null;
  if (parentTrail.length && !parent) return null;
  if (!accepts(parent, drag)) {
    // The pointer is over something whose parent won't take this. Falling
    // back to "inside" would silently move the drop somewhere the user
    // wasn't pointing, so refuse and let them aim again.
    return null;
  }
  const index = trail[trail.length - 1] + (position === 'after' ? 1 : 0);
  return {
    position,
    rect: hit.rect,
    target: { parentId: parent ? parent.id : null, index },
  };
}
