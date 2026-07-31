import React, { useMemo, useState } from 'react';
import {
  elementIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ElementContainerIcon,
  ElementVFlexIcon,
  ElementHFlexIcon,
  ElementGridIcon,
  ElementTextBlockIcon,
  ElementQuoteIcon,
  ElementEmbedIcon,
  ElementLabelIcon,
  CodeIcon,
  RepeatIcon,
} from '../ui/Icons.jsx';
import { setDrag, clearDrag } from '../dragState.js';

// The element catalogue, Webflow's Add panel shape: labelled tiles grouped by
// what they're for, rather than the alphabetical tag list the ⌘E palette shows.
//
// Every tile is a real HTML tag — nothing here is a Stacki-only widget, so what
// lands on the page is what a hand-written .astro file would have. The layout
// tiles carry an inline `style` because a bare <div> is invisible on the canvas
// and "add a flex row" should produce a flex row; everything else is the plain
// tag. Style them properly in the Style panel from there.
const GROUPS = [
  {
    name: 'Structure',
    items: [
      { label: 'Section', tag: 'section' },
      { label: 'Container', tag: 'div', style: 'max-width: 1200px; margin: 0 auto', Icon: ElementContainerIcon },
      { label: 'Div Block', tag: 'div' },
      { label: 'V Flex', tag: 'div', style: 'display: flex; flex-direction: column; gap: 16px', Icon: ElementVFlexIcon },
      { label: 'H Flex', tag: 'div', style: 'display: flex; flex-direction: row; gap: 16px', Icon: ElementHFlexIcon },
      { label: 'Grid', tag: 'div', style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 16px', Icon: ElementGridIcon },
    ],
  },
  {
    name: 'Basic',
    items: [
      { label: 'List', tag: 'ul' },
      { label: 'List Item', tag: 'li' },
      { label: 'Link Block', tag: 'a' },
      { label: 'Button', tag: 'button', text: 'Button' },
    ],
  },
  {
    name: 'Typography',
    items: [
      { label: 'Heading', tag: 'h2' },
      { label: 'Paragraph', tag: 'p' },
      { label: 'Text Link', tag: 'a', text: 'Link text' },
      { label: 'Text Block', tag: 'span', text: 'Text', Icon: ElementTextBlockIcon },
      { label: 'Block Quote', tag: 'blockquote', text: 'Quote', Icon: ElementQuoteIcon },
    ],
  },
  {
    name: 'Media',
    items: [
      { label: 'Image', tag: 'img' },
      { label: 'Video', tag: 'video' },
      { label: 'Embed', tag: 'iframe', Icon: ElementEmbedIcon },
    ],
  },
  {
    name: 'Forms',
    items: [
      { label: 'Form Block', tag: 'form' },
      { label: 'Label', tag: 'label', text: 'Label', Icon: ElementLabelIcon },
      { label: 'Input', tag: 'input' },
      { label: 'Text Area', tag: 'textarea' },
      { label: 'Select', tag: 'select' },
      { label: 'Submit', tag: 'button', text: 'Submit' },
    ],
  },
  {
    name: 'Advanced',
    items: [
      { label: 'Loop', kind: 'map', Icon: RepeatIcon },
      { label: 'Code Block', kind: 'expr', Icon: CodeIcon },
      { label: 'Style Block', kind: 'style', Icon: CodeIcon },
      { label: 'Script Block', kind: 'script', Icon: CodeIcon },
    ],
  },
];

// The palette item shape App.insertItem already understands.
const itemFor = (tile) =>
  tile.kind
    ? { type: tile.kind }
    : { type: 'element', tag: tile.tag, text: tile.text, style: tile.style };

export default function AddPanel({ onInsert, onDragBegin }) {
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState(() => new Set());

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        items: g.items.filter(
          (i) => !q || i.label.toLowerCase().includes(q) || (i.tag || '').includes(q)
        ),
      })).filter((g) => g.items.length),
    [q]
  );

  const toggle = (name) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="panel-section grow">
      <div className="panel-header">
        <h2>Add</h2>
      </div>

      <div style={{ padding: '0 12px 8px' }}>
        <input
          value={query}
          placeholder="Search elements"
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="panel-body">
        {groups.map((group) => {
          // A search narrows to what matched, so keep those groups open
          // regardless of what the user collapsed beforehand.
          const open = !!q || !closed.has(group.name);
          return (
            <div key={group.name} className="add-group">
              <button className="add-group-head" onClick={() => toggle(group.name)}>
                <span>{group.name}</span>
                {open ? <ChevronDownIcon size={10} /> : <ChevronRightIcon size={10} />}
              </button>
              {open && (
                <div className="add-grid">
                  {group.items.map((tile) => (
                    <div
                      key={`${group.name}-${tile.label}`}
                      className="add-tile"
                      draggable
                      title={tile.tag ? `<${tile.tag}>` : tile.label}
                      onClick={() => onInsert(itemFor(tile))}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('avb/element', JSON.stringify(itemFor(tile)));
                        e.dataTransfer.effectAllowed = 'copy';
                        // Recorded so the navigator can refuse a drop that
                        // would be invalid markup (a <div> inside a <p>).
                        // `item` rides along for canvas drops, which build the
                        // node from dragState rather than the dataTransfer.
                        setDrag({ kind: 'element', nodeKind: 'element', tag: tile.tag, item: itemFor(tile) });
                        // Deferred: let the browser capture the drag before
                        // this row unmounts under the panel switch.
                        if (onDragBegin) setTimeout(onDragBegin, 0);
                      }}
                      onDragEnd={clearDrag}
                    >
                      <span className="add-tile-art">
                        {tile.Icon ? <tile.Icon size={20} /> : elementIcon(tile.tag || 'div', 20)}
                      </span>
                      <span className="add-tile-label">{tile.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <div className="props-empty">No elements match “{query.trim()}”.</div>}
      </div>
    </div>
  );
}
