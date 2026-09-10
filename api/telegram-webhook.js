const LOCATIONS = {
  a: { name: 'пр. Гагарина, 58/1В (ТРЦ Армада 2)', phone: '+7 (3532) 42-40-50' },
  k: { name: 'ул. Салмышская, 71 ст3 (ТРЦ «Кит»)', phone: '+7 (3532) 92-20-50' }
};

const SERVICES = {
  oil: 'Замена моторного масла', akpp: 'Замена масла в АКПП', mkpp: 'Замена масла в МКПП',
  gur: 'Замена жидкости ГУР', red: 'Замена редукторного масла',
  svech: 'Замена свечей зажигания', kolod: 'Замена тормозных колодок',
  other: 'Иное (уточню в сообщении)'
};

const DATES = { today: 'Сегодня', tomorrow: 'Завтра', week: 'На этой неделе' };

const SOURCES = { '2gis': '2ГИС', 'yandex': 'Яндекс.Карты' };

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function setSource(chatId, source) {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    await fetch(`${KV_URL}/set/src:${chatId}/${encodeURIComponent(source)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
  } catch (e) { console.error('KV set error:', e); }
}

async function getSource(chatId) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const r = await fetch(`${KV_URL}/get/src:${chatId}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    const data = await r.json();
    return data.result || null;
  } catch (e) { console.error('KV get error:', e); return null; }
}

function sourceTag(source) {
  return source ? `\n📍 Источник: ${source}` : '';
}

const PHONE_TAG_BOOK = '#запись_на_телефон';
const PHONE_TAG_CALL = '#звонок_на_телефон';

function menuKeyboard() {
  return { inline_keyboard: [
    [{ text: '📝 Записаться', callback_data: 'menu:book' }],
    [{ text: '📞 Заказать звонок', callback_data: 'menu:call' }]
  ]};
}
function locationKeyboard(prefix) {
  return { inline_keyboard: [
    [{ text: 'Армада 2', callback_data: `${prefix}:a` }],
    [{ text: 'КИТ', callback_data: `${prefix}:k` }]
  ]};
}
function serviceKeyboard(loc) {
  return { inline_keyboard: Object.entries(SERVICES).map(([code, label]) => [
    { text: label, callback_data: `bk:svc:${loc}:${code}` }
  ])};
}
function dateKeyboard(loc, svc) {
  return { inline_keyboard: Object.entries(DATES).map(([code, label]) => [
    { text: label, callback_data: `bk:date:${loc}:${svc}:${code}` }
  ])};
}

async function tg(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true });

  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  const TELEGRAM_TOPIC_ID = process.env.TELEGRAM_TOPIC_ID;

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN is not configured");
    return res.status(200).json({ ok: true });
  }

  try {
    const update = req.body;

    // --- Обработка нажатий на инлайн-кнопки ---
    if (update?.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const messageId = cq.message.message_id;
      const data = cq.data || '';
      const fromName = [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(' ') || 'Без имени';
      const fromUsername = cq.from?.username ? `@${cq.from.username}` : '—';

      await tg(TELEGRAM_BOT_TOKEN, 'answerCallbackQuery', { callback_query_id: cq.id });
      const parts = data.split(':');

      if (data === 'menu:book') {
        await tg(TELEGRAM_BOT_TOKEN, 'editMessageText', {
          chat_id: chatId, message_id: messageId, text: 'Выберите точку:',
          reply_markup: locationKeyboard('bk:loc')
        });
      } else if (data === 'menu:call') {
        await tg(TELEGRAM_BOT_TOKEN, 'editMessageText', {
          chat_id: chatId, message_id: messageId, text: 'Из какой точки перезвонить?',
          reply_markup: locationKeyboard('call')
        });
      } else if (parts[0] === 'bk' && parts[1] === 'loc') {
        await tg(TELEGRAM_BOT_TOKEN, 'editMessageText', {
          chat_id: chatId, message_id: messageId, text: 'Выберите услугу:',
          reply_markup: serviceKeyboard(parts[2])
        });
      } else if (parts[0] === 'bk' && parts[1] === 'svc') {
        await tg(TELEGRAM_BOT_TOKEN, 'editMessageText', {
          chat_id: chatId, message_id: messageId, text: 'На когда?',
          reply_markup: dateKeyboard(parts[2], parts[3])
        });
      } else if (parts[0] === 'bk' && parts[1] === 'date') {
        const loc = parts[2], svc = parts[3], date = parts[4];
        const locInfo = LOCATIONS[loc], svcLabel = SERVICES[svc] || svc, dateLabel = DATES[date] || date;

        await tg(TELEGRAM_BOT_TOKEN, 'editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: `📍 ${locInfo.name}\n🔧 ${svcLabel}\n📅 ${dateLabel}\n\nПочти готово!`
        });
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `Укажите номер телефона, чтобы мы могли связаться и подтвердить запись.\n\n${PHONE_TAG_BOOK} loc=${loc} svc=${svc} date=${date}`,
          reply_markup: { force_reply: true, input_field_placeholder: '+7 ...' }
        });
      } else if (parts[0] === 'call') {
        const locInfo = LOCATIONS[parts[1]];
        await tg(TELEGRAM_BOT_TOKEN, 'editMessageText', {
          chat_id: chatId, message_id: messageId, text: `📍 ${locInfo.name}\n\nПочти готово!`
        });
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `Укажите номер телефона, чтобы мы вам перезвонили.\n\n${PHONE_TAG_CALL} loc=${parts[1]}`,
          reply_markup: { force_reply: true, input_field_placeholder: '+7 ...' }
        });
      }
      return res.status(200).json({ ok: true });
    }

    const message = update?.message;
    if (!message || !message.chat) return res.status(200).json({ ok: true });

    const chatId = message.chat.id;
    const fromName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') || 'Без имени';
    const fromUsername = message.from?.username ? `@${message.from.username}` : '—';

    // --- Ответ на запрос телефона (ForceReply) ---
    const repliedText = message.reply_to_message?.text || '';
    if (message.text && (repliedText.includes(PHONE_TAG_BOOK) || repliedText.includes(PHONE_TAG_CALL))) {
      const phone = message.text.trim();
      const params = Object.fromEntries(
        [...repliedText.matchAll(/(\w+)=(\w+)/g)].map(m => [m[1], m[2]])
      );
      const locInfo = LOCATIONS[params.loc];

      if (repliedText.includes(PHONE_TAG_BOOK)) {
        const svcLabel = SERVICES[params.svc] || params.svc;
        const dateLabel = DATES[params.date] || params.date;
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `✅ Заявка принята!\n\n📍 ${locInfo.name}\n🔧 ${svcLabel}\n📅 ${dateLabel}\n📞 ${phone}\n\nМы свяжемся с вами для подтверждения.`
        });
        if (TELEGRAM_CHAT_ID) {
          const source = await getSource(chatId);
          await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
            chat_id: TELEGRAM_CHAT_ID,
            message_thread_id: TELEGRAM_TOPIC_ID ? parseInt(TELEGRAM_TOPIC_ID) : undefined,
            text: `📝 *${fromName}* (${fromUsername}) заполнил заявку через бота\n\n📍 *Точка:* ${locInfo.name}\n🔧 *Услуга:* ${svcLabel}\n📅 *Дата:* ${dateLabel}\n📞 *Телефон:* ${phone}${sourceTag(source)}`,
            parse_mode: 'Markdown'
          });
        }
      } else {
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `✅ Заявка на звонок принята!\n\n📍 ${locInfo.name}\n📞 ${phone}\n\nМы позвоним вам в ближайшее время.`
        });
        if (TELEGRAM_CHAT_ID) {
          const source = await getSource(chatId);
          await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
            chat_id: TELEGRAM_CHAT_ID,
            message_thread_id: TELEGRAM_TOPIC_ID ? parseInt(TELEGRAM_TOPIC_ID) : undefined,
            text: `📞 *${fromName}* (${fromUsername}) оставил заявку на звонок\n\n📍 *Точка:* ${locInfo.name}\n📞 *Телефон:* ${phone}${sourceTag(source)}`,
            parse_mode: 'Markdown'
          });
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (!message.text) return res.status(200).json({ ok: true });
    const text = message.text.trim();

    if (text.startsWith('/start')) {
      const param = text.split(' ')[1];
      if (param && SOURCES[param]) {
        await setSource(chatId, SOURCES[param]);
      }
      await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        text: "Здравствуйте! Это Алекс-Авто — экспресс-замена масла в Оренбурге за 30 минут.\n\nНапишите сюда, чем можем помочь, или выберите вариант ниже:",
        reply_markup: menuKeyboard()
      });
    } else {
      await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: chatId,
        text: "Спасибо за сообщение! Мы отвечаем в рабочие часы (ежедневно с 09:00 до 21:00).\n\nЕсли срочно — звоните:\n📍 Армада 2: +7 (3532) 42-40-50\n📍 КИТ: +7 (3532) 92-20-50\n\nИли выберите ниже:",
        reply_markup: menuKeyboard()
      });
      if (TELEGRAM_CHAT_ID) {
        const source = await getSource(chatId);
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: TELEGRAM_CHAT_ID,
          message_thread_id: TELEGRAM_TOPIC_ID ? parseInt(TELEGRAM_TOPIC_ID) : undefined,
          text: `💬 *Сообщение боту от клиента*\n\n👤 *От:* ${fromName} (${fromUsername})\n📝 *Текст:* ${text}${sourceTag(source)}`,
          parse_mode: 'Markdown'
        });
      }
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(200).json({ ok: true });
  }
}
