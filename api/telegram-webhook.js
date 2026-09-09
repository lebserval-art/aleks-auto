export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    const update = req.body;
    const message = update?.message;
    if (!message || !message.chat || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const fromName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Без имени';
    const fromUsername = message.from?.username ? `@${message.from.username}` : '—';

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    const TELEGRAM_TOPIC_ID = process.env.TELEGRAM_TOPIC_ID;

    if (!TELEGRAM_BOT_TOKEN) {
      console.warn("TELEGRAM_BOT_TOKEN is not configured");
      return res.status(200).json({ ok: true });
    }

    const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    let reply;
    if (text === '/start') {
      reply = "Здравствуйте! Это Алекс-Авто — экспресс-замена масла в Оренбурге за 30 минут.\n\n" +
              "Напишите сюда, чем можем помочь, или оставьте заявку на сайте aleks-auto.com — мы свяжемся с вами.\n\n" +
              "📞 +7 (3532) 42-40-50 / 92-20-50";
    } else {
      reply = "Спасибо за сообщение! Мы отвечаем в рабочие часы (ежедневно с 09:00 до 21:00). " +
              "Если срочно — звоните: +7 (3532) 42-40-50.";

      // Пересылаем реальный вопрос клиента в рабочий чат с заявками
      if (TELEGRAM_CHAT_ID) {
        const forwardText = `💬 *Сообщение боту от клиента*\n\n` +
          `👤 *От:* ${fromName} (${fromUsername})\n` +
          `📝 *Текст:* ${text}`;
        await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            message_thread_id: TELEGRAM_TOPIC_ID ? parseInt(TELEGRAM_TOPIC_ID) : undefined,
            text: forwardText,
            parse_mode: 'Markdown'
          })
        });
      }
    }

    await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: reply })
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).json({ ok: true });
  }
}
