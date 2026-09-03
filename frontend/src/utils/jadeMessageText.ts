import type { JadeMessageBlock } from '../services/askJadeService';

type JadeMessageLike = {
  text: string;
  blocks?: JadeMessageBlock[];
};

/**
 * Renders one non-prose block as plain text. Charts have no useful textual
 * form beyond their labelled values, so each one collapses to the same
 * "label: value" summary the screen reader already announces. Blocks whose data
 * is empty or unavailable render nothing — copying a title with no numbers
 * under it would read as missing data rather than as an intentional omission.
 */
const blockToLines = (block: JadeMessageBlock): string[] => {
  if (block.type === 'text') {
    return [block.text.trim()];
  }

  if (block.type === 'list') {
    return block.items.map((item, index) =>
      block.style === 'numbered' ? `${index + 1}. ${item}` : `• ${item}`,
    );
  }

  if (block.dataState !== 'ready') {
    return [];
  }

  if (block.type === 'stats') {
    return [
      block.title,
      ...block.items.map(item => `${item.label}: ${item.value}`),
    ];
  }

  if (block.type === 'mood_trend') {
    const points = block.points.filter(point => point.mood);

    return points.length
      ? [block.title, ...points.map(point => `${point.label}: ${point.mood}`)]
      : [];
  }

  if (block.type === 'mood_distribution') {
    return [
      block.title,
      ...block.segments.map(item => `${item.label}: ${item.percentage}%`),
    ];
  }

  return [
    block.title,
    ...block.points.map(point => `${point.label}: ${point.count} entries`),
  ];
};

/**
 * Flattens a Jade message into the text used by explicit copy and share actions.
 *
 * The order mirrors `JadeMessageContent`: the prose paragraph first, then the
 * remaining blocks as rendered. Copy is meant to match what the user is
 * looking at, not the raw block array.
 */
export const jadeMessageToPlainText = ({
  blocks,
  text,
}: JadeMessageLike): string => {
  const messageBlocks = blocks || [];
  const prose = messageBlocks.find(block => block.type === 'text');
  const sections: string[] = [];
  const leadingText = (prose?.type === 'text' ? prose.text : text).trim();

  if (leadingText) {
    sections.push(leadingText);
  }

  messageBlocks.slice(1).forEach(block => {
    if (block.type === 'text') {
      return;
    }

    const lines = blockToLines(block).filter(Boolean);

    if (lines.length) {
      sections.push(lines.join('\n'));
    }
  });

  return sections.join('\n\n').trim() || text.trim();
};
