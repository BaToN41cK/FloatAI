// Централизованное хранилище состояния renderer на Proxy: один источник правды
// для статуса, стриминга, прикреплённого изображения и настроек. Модули не держат
// собственные разрозненные переменные — читают/пишут сюда и могут подписываться
// на изменения (store.subscribe), что делает поток данных предсказуемым.
const listeners = new Set();

function notify(key, value) {
  for (const fn of listeners) {
    try { fn(key, value); } catch (e) { console.warn('[store] listener error', e); }
  }
}

export const store = {
  state: new Proxy({
    streaming: false,      // идёт стриминг ответа (кнопка «Отправить» заблокирована)
    status: '',            // текст статус-бара
    pendingImage: null,    // прикреплённое изображение { base64, mime }
    greeted: false,        // показывали ли приветствие
    settings: null         // последние загруженные настройки
  }, {
    set(target, key, value) {
      if (target[key] === value) return true;
      target[key] = value;
      notify(String(key), value);
      return true;
    }
  }),
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
};
