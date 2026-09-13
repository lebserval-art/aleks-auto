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

// Состояние многошаговых диалогов кодируем в base64(JSON) и прячем в текст
// сообщения с ForceReply — Telegram присылает его обратно в reply_to_message.text.
// Это позволяет передавать произвольный текст (марка авто, название детали
// на кириллице с пробелами), в отличие от старой схемы key=value на \w+.
function encodeState(obj) {
  return Buffer.from(JSON.stringify(obj || {})).toString('base64');
}
function decodeState(str) {
  try { return JSON.parse(Buffer.from(str, 'base64').toString('utf8')); }
  catch (e) { return {}; }
}
function stateAfterTag(repliedText, tag) {
  const idx = repliedText.indexOf(tag);
  if (idx === -1) return null;
  const rest = repliedText.slice(idx + tag.length).trim();
  return rest ? decodeState(rest) : {};
}
function isSkip(text) {
  const t = text.trim();
  return t === '-' || /^нет$/i.test(t);
}

const PHONE_TAG_BOOK = '#запись_на_телефон';
const PHONE_TAG_CALL = '#звонок_на_телефон';
const BOOK_CAR_TAG = '#запись_авто';
const PARTS_CAR_TAG = '#запчасти_авто';
const PARTS_PART_TAG = '#запчасти_деталь';
const PARTS_VIN_TAG = '#запчасти_vin';
const PARTS_PHONE_TAG = '#запчасти_телефон';

function menuKeyboard() {
  return { inline_keyboard: [
    [{ text: '📝 Записаться', callback_data: 'menu:book' }],
    [{ text: '📞 Заказать звонок', callback_data: 'menu:call' }],
    [{ text: '🔧 Подбор запчастей', callback_data: 'menu:parts' }]
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
      } else if (data === 'menu:parts') {
        await tg(TELEGRAM_BOT_TOKEN, 'editMessageText', {
          chat_id: chatId, message_id: messageId,
          text: 'Подбор и заказ запчастей (Совхозная) — для иномарок.\n\nУкажите марку и модель автомобиля:'
        });
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `Напишите марку и модель автомобиля.\n\n${PARTS_CAR_TAG}`,
          reply_markup: { force_reply: true, input_field_placeholder: 'Например: Toyota Camry' }
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
          text: `Укажите марку и модель автомобиля — это поможет подготовить нужные масла и запчасти к визиту. Если не хотите указывать, отправьте "-".\n\n${BOOK_CAR_TAG} ${encodeState({ loc, svc, date })}`,
          reply_markup: { force_reply: true, input_field_placeholder: 'Например: Toyota Camry, или -' }
        });
      } else if (parts[0] === 'call') {
        const loc = parts[1];
        const locInfo = LOCATIONS[loc];
        await tg(TELEGRAM_BOT_TOKEN, 'editMessageText', {
          chat_id: chatId, message_id: messageId, text: `📍 ${locInfo.name}\n\nПочти готово!`
        });
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `Укажите номер телефона, чтобы мы вам перезвонили.\n\n${PHONE_TAG_CALL} ${encodeState({ loc })}`,
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

    // --- Ответы на цепочки ForceReply (запись на сервис / звонок / подбор запчастей) ---
    const repliedText = message.reply_to_message?.text || '';
    if (message.text && repliedText) {
      const bookCarState = stateAfterTag(repliedText, BOOK_CAR_TAG);
      const phoneBookState = stateAfterTag(repliedText, PHONE_TAG_BOOK);
      const phoneCallState = stateAfterTag(repliedText, PHONE_TAG_CALL);
      const partsCarState = stateAfterTag(repliedText, PARTS_CAR_TAG);
      const partsPartState = stateAfterTag(repliedText, PARTS_PART_TAG);
      const partsVinState = stateAfterTag(repliedText, PARTS_VIN_TAG);
      const partsPhoneState = stateAfterTag(repliedText, PARTS_PHONE_TAG);

      if (bookCarState !== null) {
        const car = isSkip(message.text) ? '' : message.text.trim();
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `Укажите номер телефона, чтобы мы могли связаться и подтвердить запись.\n\n${PHONE_TAG_BOOK} ${encodeState({ ...bookCarState, car })}`,
          reply_markup: { force_reply: true, input_field_placeholder: '+7 ...' }
        });
        return res.status(200).json({ ok: true });
      }

      if (phoneBookState !== null) {
        const phone = message.text.trim();
        const { loc, svc, date, car } = phoneBookState;
        const locInfo = LOCATIONS[loc];
        const svcLabel = SERVICES[svc] || svc;
        const dateLabel = DATES[date] || date;
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `✅ Заявка принята!\n\n📍 ${locInfo.name}\n🔧 ${svcLabel}\n📅 ${dateLabel}${car ? `\n🚗 ${car}` : ''}\n📞 ${phone}\n\nМы свяжемся с вами для подтверждения.`
        });
        if (TELEGRAM_CHAT_ID) {
          const source = await getSource(chatId);
          await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
            chat_id: TELEGRAM_CHAT_ID,
            message_thread_id: TELEGRAM_TOPIC_ID ? parseInt(TELEGRAM_TOPIC_ID) : undefined,
            text: `📝 *${fromName}* (${fromUsername}) заполнил заявку через бота\n\n📍 *Точка:* ${locInfo.name}\n🔧 *Услуга:* ${svcLabel}\n📅 *Дата:* ${dateLabel}${car ? `\n🚗 *Авто:* ${car}` : ''}\n📞 *Телефон:* ${phone}${sourceTag(source)}`,
            parse_mode: 'Markdown'
          });
        }
        return res.status(200).json({ ok: true });
      }

      if (phoneCallState !== null) {
        const phone = message.text.trim();
        const locInfo = LOCATIONS[phoneCallState.loc];
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
        return res.status(200).json({ ok: true });
      }

      if (partsCarState !== null) {
        const car = message.text.trim();
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `Укажите наименование нужной детали.\n\n${PARTS_PART_TAG} ${encodeState({ car })}`,
          reply_markup: { force_reply: true, input_field_placeholder: 'Например: тормозные колодки' }
        });
        return res.status(200).json({ ok: true });
      }

      if (partsPartState !== null) {
        const part = message.text.trim();
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `Если знаете VIN — укажите, это ускорит подбор. Если не знаете, отправьте "-".\n\n${PARTS_VIN_TAG} ${encodeState({ ...partsPartState, part })}`,
          reply_markup: { force_reply: true, input_field_placeholder: 'VIN, или -' }
        });
        return res.status(200).json({ ok: true });
      }

      if (partsVinState !== null) {
        const vin = isSkip(message.text) ? '' : message.text.trim();
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `Укажите номер телефона для связи.\n\n${PARTS_PHONE_TAG} ${encodeState({ ...partsVinState, vin })}`,
          reply_markup: { force_reply: true, input_field_placeholder: '+7 ...' }
        });
        return res.status(200).json({ ok: true });
      }

      if (partsPhoneState !== null) {
        const phone = message.text.trim();
        const { car, part, vin } = partsPhoneState;
        await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `✅ Заявка на подбор запчасти принята!\n\n🚗 ${car}\n🔩 ${part}${vin ? `\n🔑 VIN: ${vin}` : ''}\n📞 ${phone}\n\nМы свяжемся с вами по наличию и цене.`
        });
        if (TELEGRAM_CHAT_ID) {
          const source = await getSource(chatId);
          await tg(TELEGRAM_BOT_TOKEN, 'sendMessage', {
            chat_id: TELEGRAM_CHAT_ID,
            message_thread_id: TELEGRAM_TOPIC_ID ? parseInt(TELEGRAM_TOPIC_ID) : undefined,
            text: `🔩 *${fromName}* (${fromUsername}) запросил подбор запчасти через бота\n\n🚗 *Авто:* ${car}\n🔩 *Деталь:* ${part}${vin ? `\n🔑 *VIN:* ${vin}` : ''}\n📞 *Телефон:* ${phone}${sourceTag(source)}`,
            parse_mode: 'Markdown'
          });
        }
        return res.status(200).json({ ok: true });
      }
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
