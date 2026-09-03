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

    if (!TELEGRAM_BOT_TOKEN) {
      console.warn("TELEGRAM_BOT_TOKEN is not configured");
      return res.status(200).json({ success: true, warning: "Telegram token not configured on server" });
    }

    const text = `🔔 *Новая заявка на запись (Алекс-Авто)*\n\n` +
      `👤 *Имя:* ${name}\n` +
      `📞 *Телефон:* ${phone}\n` +
      `📍 *Точка:* ${location}\n` +
      `🔧 *Услуга:* ${service || 'Не указана'}\n` +
      `📅 *Дата:* ${date || 'Ближайшее время'}\n` +
      `💬 *Комментарий:* ${comment || '—'}\n\n` +
      `⏱ _Отправлено с сайта aleks-auto.com_`;

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
      return res.status(500).json({ error: 'Telegram API Error', details: result.description });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Booking error:", err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
