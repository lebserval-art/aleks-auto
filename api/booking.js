export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, phone, location, service, date, comment } = req.body || {};

    if (!name || !phone || !location) {
      return res.status(400).json({ error: 'Заполните обязательные поля: имя, телефон, точку' });
    }

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1004311094405";
    const TELEGRAM_TOPIC_ID = process.env.TELEGRAM_TOPIC_ID || "458";

    const text = `🔔 *Новая заявка на запись (Алекс-Авто)*\n\n` +
      `👤 *Имя:* ${name}\n` +
      `📞 *Телефон:* ${phone}\n` +
      `📍 *Точка:* ${location}\n` +
      `🔧 *Услуга:* ${service || 'Не указана'}\n` +
      `📅 *Дата:* ${date || 'Ближайшее время'}\n` +
      `💬 *Комментарий:* ${comment || '—'}\n\n` +
      `⏱ _Отправлено с сайта aleks-auto.com_\n` +
      `📍 Источник: Сайт`;

    // Тот же текст без markdown-разметки — для MAX (у него своя разметка, проще не рисковать форматированием)
    const plainText = `🔔 Новая заявка на запись (Алекс-Авто)\n\n` +
      `👤 Имя: ${name}\n` +
      `📞 Телефон: ${phone}\n` +
      `📍 Точка: ${location}\n` +
      `🔧 Услуга: ${service || 'Не указана'}\n` +
      `📅 Дата: ${date || 'Ближайшее время'}\n` +
      `💬 Комментарий: ${comment || '—'}\n\n` +
      `⏱ Отправлено с сайта aleks-auto.com\n` +
      `📍 Источник: Сайт`;

    let telegramOk = true;
    let telegramError = null;

    if (!TELEGRAM_BOT_TOKEN) {
      console.warn("TELEGRAM_BOT_TOKEN is not configured");
    } else {
      try {
        const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            message_thread_id: TELEGRAM_TOPIC_ID ? parseInt(TELEGRAM_TOPIC_ID) : undefined,
            text: text,
            parse_mode: 'Markdown'
          })
        });
        const result = await response.json();
        if (!result.ok) {
          console.error("Telegram API Error:", result);
          telegramOk = false;
          telegramError = result.description;
        }
      } catch (err) {
        console.error("Telegram send failed:", err);
        telegramOk = false;
        telegramError = err.message;
      }
    }

    // Отправка в MAX — параллельный канал уведомлений, не блокирует основной ответ.
    // Если переменные не заданы или отправка не удалась — заявка всё равно считается принятой,
    // пока хотя бы Telegram отработал штатно.
    const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN;
    const MAX_CHAT_ID = process.env.MAX_CHAT_ID;

    if (MAX_BOT_TOKEN && MAX_CHAT_ID) {
      try {
        const maxUrl = `https://platform-api2.max.ru/messages?chat_id=${MAX_CHAT_ID}`;
        const maxResponse = await fetch(maxUrl, {
          method: 'POST',
          headers: {
            'Authorization': MAX_BOT_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text: plainText })
        });
        if (!maxResponse.ok) {
          const maxErrText = await maxResponse.text();
          console.error("MAX API Error:", maxResponse.status, maxErrText);
        }
      } catch (err) {
        console.error("MAX send failed:", err);
      }
    }

    if (!telegramOk) {
      return res.status(500).json({ error: 'Telegram API Error', details: telegramError });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Booking error:", err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
