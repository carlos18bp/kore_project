import fs from 'node:fs';
import path from 'node:path';

describe('global clickable cursor styles', () => {
  it('defines pointer cursor for interactive elements and not-allowed for disabled controls', () => {
    const cssPath = path.join(process.cwd(), 'app', 'globals.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('a[href]');
    expect(css).toContain('button');
    expect(css).toContain("[role='button']");
    expect(css).toContain('cursor: pointer;');

    expect(css).toContain('button:disabled');
    expect(css).toContain('[aria-disabled=\'true\']');
    expect(css).toContain('cursor: not-allowed;');
  });
});
