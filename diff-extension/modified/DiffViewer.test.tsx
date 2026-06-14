import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DiffViewer } from '../DiffViewer';

describe('DiffViewer', () => {
  it('renders unchanged content without diff highlighting', () => {
    const { container } = render(
      <DiffViewer oldValue="hello world" newValue="hello world" fileName="test.txt" />
    );
    expect(container.textContent).toContain('hello world');
  });

  it('renders added and removed lines', () => {
    const { container } = render(
      <DiffViewer oldValue="old line" newValue="new line" fileName="test.ts" />
    );
    expect(container.textContent).toContain('old line');
    expect(container.textContent).toContain('new line');
  });

  it('renders context lines between changes', () => {
    const oldValue = 'line1\nunchanged\nline3';
    const newValue = 'line1\nunchanged\nline3b';
    const { container } = render(
      <DiffViewer oldValue={oldValue} newValue={newValue} fileName="test.ts" />
    );
    expect(container.textContent).toContain('unchanged');
  });

  it('renders file name header', () => {
    const { container } = render(
      <DiffViewer oldValue="a" newValue="b" fileName="example.tsx" />
    );
    expect(container.textContent).toContain('example.tsx');
  });

  it('handles empty old value', () => {
    const { container } = render(
      <DiffViewer oldValue="" newValue="new content" fileName="test.txt" />
    );
    expect(container.textContent).toContain('new content');
  });

  it('handles empty new value', () => {
    const { container } = render(
      <DiffViewer oldValue="old content" newValue="" fileName="test.txt" />
    );
    expect(container.textContent).toContain('old content');
  });

  it('renders syntax-highlighted content for TypeScript', () => {
    const oldValue = 'const x = 5;';
    const newValue = 'const y = 10;';
    const { container } = render(
      <DiffViewer oldValue={oldValue} newValue={newValue} fileName="test.ts" />
    );
    // Should render both lines
    expect(container.textContent).toContain('const');
  });

  it('renders syntax-highlighted content for JavaScript', () => {
    const oldValue = 'function foo() {}';
    const newValue = 'function bar() {}';
    const { container } = render(
      <DiffViewer oldValue={oldValue} newValue={newValue} fileName="test.js" />
    );
    expect(container.textContent).toContain('function');
  });

  it('renders syntax-highlighted content for Rust', () => {
    const oldValue = 'fn main() {}';
    const newValue = 'fn hello() {}';
    const { container } = render(
      <DiffViewer oldValue={oldValue} newValue={newValue} fileName="test.rs" />
    );
    expect(container.textContent).toContain('fn');
  });

  it('renders syntax-highlighted content for Python', () => {
    const oldValue = 'def foo(): pass';
    const newValue = 'def bar(): pass';
    const { container } = render(
      <DiffViewer oldValue={oldValue} newValue={newValue} fileName="test.py" />
    );
    expect(container.textContent).toContain('def');
  });

  it('renders syntax-highlighted content for Go', () => {
    const oldValue = 'func main() {}';
    const newValue = 'func hello() {}';
    const { container } = render(
      <DiffViewer oldValue={oldValue} newValue={newValue} fileName="test.go" />
    );
    expect(container.textContent).toContain('func');
  });

  it('renders multiple changed lines', () => {
    const oldValue = 'a\nb\nc\nd\ne';
    const newValue = 'A\nB\nC\nD\nE';
    const { container } = render(
      <DiffViewer oldValue={oldValue} newValue={newValue} fileName="test.txt" />
    );
    expect(container.textContent).toContain('a');
    expect(container.textContent).toContain('A');
    expect(container.textContent).toContain('e');
    expect(container.textContent).toContain('E');
  });

  it('renders pure additions (no matching removals)', () => {
    const oldValue = 'existing';
    const newValue = 'existing\nnew line 1\nnew line 2';
    const { container } = render(
      <DiffViewer oldValue={oldValue} newValue={newValue} fileName="test.txt" />
    );
    expect(container.textContent).toContain('existing');
    expect(container.textContent).toContain('new line 1');
    expect(container.textContent).toContain('new line 2');
  });

  it('renders pure removals (no matching additions)', () => {
    const oldValue = 'to remove\nexisting';
    const newValue = 'existing';
    const { container } = render(
      <DiffViewer oldValue={oldValue} newValue={newValue} fileName="test.txt" />
    );
    expect(container.textContent).toContain('existing');
    expect(container.textContent).toContain('to remove');
  });

  it('renders no content when both values are undefined', () => {
    const { container } = render(
      <DiffViewer fileName="test.txt" />
    );
    expect(container.textContent).toContain('test.txt');
    expect(container.textContent).not.toContain('+');
    expect(container.textContent).not.toContain('-');
  });
});
