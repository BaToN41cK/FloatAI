const test = require('node:test');
const assert = require('node:assert/strict');
const { finalizeSearch, isYouTubeUrl, extractEmbeddedJson, walkVideoRenderers } = require('../src/web-tools');

test('finalizeSearch не падает и формирует список источников (регрессия .join()( ))', () => {
  const res = finalizeSearch('тест', [
    { url: 'https://example.com/a', title: 'A', snippet: 'первый' },
    { url: 'https://example.com/b', title: 'B', snippet: 'второй' }
  ]);
  assert.equal(res.results.length, 2);
  assert.ok(res.answer.includes('1. [A](https://example.com/a)'));
  assert.ok(res.answer.includes('2. [B](https://example.com/b)'));
  assert.equal(res.sourceCount, 2);
});

test('finalizeSearch: несколько результатов с одной площадки не схлопываются', () => {
  const res = finalizeSearch('тест', [
    { url: 'https://www.youtube.com/watch?v=aaa', title: 'Видео 1', snippet: '' },
    { url: 'https://www.youtube.com/watch?v=bbb', title: 'Видео 2', snippet: '' },
    { url: 'https://www.youtube.com/@channel', title: 'Канал', snippet: '' },
    { url: 'https://www.twitch.tv/slever', title: 'Twitch', snippet: '' }
  ]);
  assert.equal(res.results.length, 4, 'дедуп по хосту ломал выдачу одной площадки');
});

test('isYouTubeUrl распознаёт все формы ссылок', () => {
  assert.equal(isYouTubeUrl('https://www.youtube.com/watch?v=x'), true);
  assert.equal(isYouTubeUrl('https://youtu.be/x'), true);
  assert.equal(isYouTubeUrl('https://youtube.com/@channel'), true);
  assert.equal(isYouTubeUrl('https://m.youtube.com/results?search_query=x'), true);
  assert.equal(isYouTubeUrl('https://example.com/watch?v=x'), false);
});

test('extractEmbeddedJson вытаскивает встроенный JSON по скобочному балансу', () => {
  const html = 'var ytInitialData = {"a":{"b":"текст \\" с кавычками {\\"}"},"c":[1,2,{"videoRenderer":{"videoId":"vid1","title":{"runs":[{"text":"Тест"}]}}}]};var x=1;';
  const data = extractEmbeddedJson(html, 'ytInitialData');
  assert.ok(data, 'JSON должен распарситься');
  const videos = [];
  walkVideoRenderers(data, videos, 10);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].videoId, 'vid1');
  assert.equal(videos[0].title, 'Тест');
});

test('DDG-Lite: редиректор /l/?uddg= декодируется в конечный URL', () => {
  const { extractRedirectUrl } = require('../src/web-tools');
  const encoded = encodeURIComponent('https://www.twitch.tv/justslever');
  const decoded = extractRedirectUrl('//duckduckgo.com/l/?uddg=' + encoded + '&rut=abc');
  assert.equal(decoded, 'https://www.twitch.tv/justslever');
  assert.equal(extractRedirectUrl('https://example.com/x'), 'https://example.com/x');
});
