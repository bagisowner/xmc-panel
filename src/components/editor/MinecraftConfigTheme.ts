import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Craft Command Center - Premium Arix Twilight Editor Theme
export const craftCommandCenterEditorTheme = EditorView.theme(
  {
    '&': {
      color: '#f1f5f9',
      backgroundColor: '#0a071a',
      height: '100%',
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
    },
    '.cm-content': {
      caretColor: '#c084fc',
      padding: '8px 0',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#c084fc',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: '#3b1c6e !important',
    },
    '.cm-selectionMatch': {
      backgroundColor: '#4c1d95',
    },
    '.cm-activeLine': {
      backgroundColor: '#160f38',
    },
    '.cm-gutters': {
      backgroundColor: '#080516',
      color: '#64748b',
      borderRight: '1px solid #1e1642',
      paddingRight: '4px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#160f38',
      color: '#c084fc',
      fontWeight: 'bold',
    },
    '.cm-foldGutter span': {
      color: '#a855f7',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'inherit',
    },
  },
  { dark: true }
);

export const craftCommandCenterHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.lineComment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.variableName, color: '#c084fc' }, // Keys
  { tag: t.propertyName, color: '#c084fc', fontWeight: '600' },
  { tag: t.keyword, color: '#e879f9' },
  { tag: t.bool, color: '#f59e0b', fontWeight: 'bold' }, // true / false
  { tag: t.number, color: '#38bdf8' }, // Integers / ports / distances
  { tag: t.string, color: '#34d399' }, // Strings / names / motd
  { tag: t.operator, color: '#a855f7' }, // = or :
  { tag: t.punctuation, color: '#94a3b8' },
  { tag: t.heading, color: '#f43f5e', fontWeight: 'bold' }, // Section headers
  { tag: t.invalid, color: '#ef4444', textDecoration: 'underline wavy' },
]);

export const craftCommandCenterTheme: Extension = [
  craftCommandCenterEditorTheme,
  syntaxHighlighting(craftCommandCenterHighlightStyle),
];
