const fs = require('node:fs');
const path = require('node:path');

// Preserve the supplied GIF's image data and frame timing. Extend only its
// final-frame hold by three seconds between completed playbacks.
function buildVisualIcon() {
  const icons = path.resolve(__dirname, '../src/pic/icon');
  const gif = Buffer.from(fs.readFileSync(path.join(icons, 'visual.gif')));
  if (!/^GIF8[79]a$/.test(gif.toString('ascii', 0, 6))) throw new Error('Invalid visual.gif header');
  let cursor = 13 + ((gif[10] & 0x80) ? 3 * (1 << ((gif[10] & 7) + 1)) : 0);
  let pendingDelay = -1;
  const delays = [];
  const skipBlocks = () => {
    while (cursor < gif.length && gif[cursor]) cursor += 1 + gif[cursor];
    if (cursor >= gif.length) throw new Error('Truncated visual.gif');
    cursor++;
  };
  while (cursor < gif.length && gif[cursor] !== 0x3b) {
    const marker = gif[cursor];
    if (marker === 0x21) {
      if (gif[cursor + 1] === 0xf9) pendingDelay = cursor + 4;
      cursor += 2;
      skipBlocks();
    } else if (marker === 0x2c) {
      if (pendingDelay < 0) throw new Error('visual.gif frame has no timing metadata');
      delays.push(pendingDelay);
      pendingDelay = -1;
      const packed = gif[cursor + 9];
      cursor += 10 + ((packed & 0x80) ? 3 * (1 << ((packed & 7) + 1)) : 0);
      cursor++; // LZW minimum code size.
      skipBlocks();
    } else {
      throw new Error(`Unexpected visual.gif block at ${cursor}`);
    }
  }
  if (!delays.length) throw new Error('visual.gif has no frames');
  const last = delays.at(-1);
  gif.writeUInt16LE(gif.readUInt16LE(last) + 300, last);
  const loop = gif.indexOf(Buffer.from('NETSCAPE2.0'));
  if (loop < 0) throw new Error('visual.gif is missing its loop extension');
  gif.writeUInt16LE(0, loop + 13);
  fs.writeFileSync(path.join(icons, 'visual-3s.gif'), gif);
}

if (require.main === module) buildVisualIcon();
module.exports = { buildVisualIcon };
