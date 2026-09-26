import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AppBar from '../components/common/AppBar';
import RobotAvatar from '../components/common/RobotAvatar';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Demo User', plan: 'free' }, logout: vi.fn() }),
}));

const publicFiles = readdirSync(resolve('public'));

function parse(markup) {
  return new DOMParser().parseFromString(markup, 'text/html');
}

describe('Vera branding', () => {
  it('uses Vera in the browser title and social metadata', () => {
    const page = parse(readFileSync(resolve('index.html'), 'utf8'));
    expect(page.title).toBe('Vera — Your AI Assistant, Reimagined');
    expect(page.querySelector('meta[property="og:title"]').content).toBe(page.title);
    expect(page.querySelector('meta[name="description"]').content).toMatch(/^Vera is /);
  });

  it('shows VERA in the chat app bar with a real, case-matching avatar asset', () => {
    const page = parse(renderToStaticMarkup(
      <MemoryRouter initialEntries={['/dashboard']}><AppBar /></MemoryRouter>
    ));
    const logo = page.querySelector('#appbar-home-logo');
    const avatar = logo.querySelector('img');
    expect(logo.textContent.trim()).toBe('VERA');
    expect(avatar.alt).toBe('Vera');
    expect(avatar.getAttribute('src')).toBe('/Vera-avatar.jpg');
    // Check exact case as Render's filesystem is case-sensitive.
    expect(publicFiles).toContain(avatar.getAttribute('src').slice(1));
  });

  it('uses the same existing asset for assistant messages', () => {
    const page = parse(renderToStaticMarkup(<RobotAvatar size="xs" />));
    const avatar = page.querySelector('img');
    expect(avatar.alt).toBe('Vera AI');
    expect(avatar.getAttribute('src')).toBe('/Vera-avatar.jpg');
    expect(publicFiles).toContain(avatar.getAttribute('src').slice(1));
  });
});
