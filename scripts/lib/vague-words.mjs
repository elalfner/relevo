// Vague appearance words in an issue: a warning that becomes a question, never a failure. Implements "Vague appearance
// words are a warning that becomes a question" of the issue specification.

import { readFileSync } from 'node:fs';
import { section } from './issue-sections.mjs';

const WORDS = JSON.parse(readFileSync(new URL('../../knowledge/interface/vague-words.json', import.meta.url), 'utf8'));
// A number with a unit, a token name in backticks, or a reference: the sentence gives a criterion, so the word is not vague.
const UNIT = /\b\d+(?:[.,]\d+)?\s?(?:px|dp|pt|rem|em|%|ms|s|sec|seconds?|segundos?|vw|vh|ch|fps|kb|mb|x)\b/i;
const TOKEN = /`[^`]+`/;
const REFERENCE = /https?:\/\/\S+|\b[\w.-]+\/[\w./-]+\.\w+\b|#\d+|\bD\d+\b|\bC\d+\b/;
const normalise = (t) => String(t).toLowerCase().normalize('NFC');

/** The list of words for a language (the first two letters), English when there is none. */
export function wordsFor(language) {
  const key = String(language ?? 'en').slice(0, 2).toLowerCase();
  return WORDS[key] ?? WORDS.en;
}

const sentencesOf = (text) => String(text).split(/\n|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

/**
 * The sentences of the scenarios, decisions, constraints and reference bullets that hold a vague word and give no
 * number with a unit, no token in backticks and no reference. Returns [{ sentence, word, where }].
 */
export function vagueWarnings(body, language = 'en') {
  const words = wordsFor(language);
  const places = [
    ['Scenarios', section(body, 'Scenarios')?.text],
    ['Decisions', section(body, 'Decisions')?.text],
    ['Constraints', section(body, 'Constraints')?.text],
    // The target of a reference bullet is what it points to; only what must match is read.
    ['Design reference', String(section(body, 'Design reference')?.text ?? '').split('\n').filter((l) => /^\s*[-*+]\s/.test(l)).map((l) => l.replace(/^\s*[-*+]\s+(`[^`]+`|<?https?:\/\/\S+?>?)\s*:?\s*/, '')).join('\n')],
  ];
  const out = [];
  places.forEach(([where, text]) => {
    if (!text) return;
    sentencesOf(text).forEach((raw) => {
      // The label of a decision or a constraint (`C1:`) is not a reference to one.
      const sentence = raw.replace(/^(?:[-*+]\s+)?(?:\*\*)?[CD]\d+(?:\*\*)?\s*[.:]\s*/, '');
      if (UNIT.test(sentence) || TOKEN.test(sentence) || REFERENCE.test(sentence)) return;
      const lower = normalise(sentence);
      const word = words.find((w) => new RegExp(`(^|[^\\p{L}])${normalise(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u').test(lower));
      if (word) out.push({ sentence: sentence.replace(/^[-*+]\s+/, '').slice(0, 140), word, where });
    });
  });
  return out;
}
