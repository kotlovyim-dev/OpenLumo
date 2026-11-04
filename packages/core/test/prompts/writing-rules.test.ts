import { describe, expect, it } from 'vitest';
import { bannedPhrases, bannedWords, findBannedPhrases, writingRules } from '../../src/prompts/writing-rules';

describe('findBannedPhrases', () => {
  it('finds banned words in any case and common inflections', () => {
    expect(findBannedPhrases('We Leveraged our ROBUST oven and keep fostering seamlessly fresh bread.')).toEqual([
      'robust',
      'seamless',
      'leverage',
      'foster',
    ]);
    expect(findBannedPhrases('A next level loaf from a world-class team.')).toEqual(['next-level', 'world-class']);
  });

  it('finds banned phrases, including curly apostrophes', () => {
    expect(findBannedPhrases('Let’s dive in. Studies show bread is good.')).toEqual(["Let's dive in", 'studies show']);
  });

  it('returns nothing for plain specific copy or words that merely contain a banned word', () => {
    expect(findBannedPhrases('Our sourdough rests for 36 hours. Undelve? No: a dynamo.')).toEqual([]);
  });

  it('checks the same lists the writing rules ban', () => {
    for (const entry of [...bannedWords, ...bannedPhrases]) expect(writingRules).toContain(entry);
  });
});
