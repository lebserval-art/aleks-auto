// api/max-webhook.js
// Интерактивный бот для MAX — повторяет флоу Telegram-бота (menu:book / menu:call →
// точка → услуга → дата → телефон), используя REST API MAX (platform-api2.max.ru)
// и то же самое Vercel KV, что и telegram-webhook.js (просто с префиксом "max:" в ключах).
//
// У MAX нет аналога Telegram force_reply, поэтому "жду телефон" храним как флаг в KV:
// когда просим телефон — ставим ключ max:wait:{chatId}, следующее текстовое сообщение
// от этого chatId считаем телефоном (и сразу удаляем флаг).

import https from 'https';
const RU_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIFwjCCA6qgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAxMjEwNDE1WhcNMzIwMjI3MjEwNDE1WjBwMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMSAwHgYDVQQDDBdSdXNzaWFuIFRydXN0ZWQgUm9v
dCBDQTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAMfFOZ8pUAL3+r2n
qqE0Zp52selXsKGFYoG0GM5bwz1bSFtCt+AZQMhkWQheI3poZAToYJu69pHLKS6Q
XBiwBC1cvzYmUYKMYZC7jE5YhEU2bSL0mX7NaMxMDmH2/NwuOVRj8OImVa5s1F4U
zn4Kv3PFlDBjjSjXKVY9kmjUBsXQrIHeaqmUIsPIlNWUnimXS0I0abExqkbdrXbX
YwCOXhOO2pDUx3ckmJlCMUGacUTnylyQW2VsJIyIGA8V0xzdaeUXg0VZ6ZmNUr5Y
Ber/EAOLPb8NYpsAhJe2mXjMB/J9HNsoFMBFJ0lLOT/+dQvjbdRZoOT8eqJpWnVD
U+QL/qEZnz57N88OWM3rabJkRNdU/Z7x5SFIM9FrqtN8xewsiBWBI0K6XFuOBOTD
4V08o4TzJ8+Ccq5XlCUW2L48pZNCYuBDfBh7FxkB7qDgGDiaftEkZZfApRg2E+M9
G8wkNKTPLDc4wH0FDTijhgxR3Y4PiS1HL2Zhw7bD3CbslmEGgfnnZojNkJtcLeBH
BLa52/dSwNU4WWLubaYSiAmA9IUMX1/RpfpxOxd4Ykmhz97oFbUaDJFipIggx5sX
ePAlkTdWnv+RWBxlJwMQ25oEHmRguNYf4Zr/Rxr9cS93Y+mdXIZaBEE0KS2iLRqa
OiWBki9IMQU4phqPOBAaG7A+eP8PAgMBAAGjZjBkMB0GA1UdDgQWBBTh0YHlzlpf
BKrS6badZrHF+qwshzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzAS
BgNVHRMBAf8ECDAGAQH/AgEEMA4GA1UdDwEB/wQEAwIBhjANBgkqhkiG9w0BAQsF
AAOCAgEAALIY1wkilt/urfEVM5vKzr6utOeDWCUczmWX/RX4ljpRdgF+5fAIS4vH
tmXkqpSCOVeWUrJV9QvZn6L227ZwuE15cWi8DCDal3Ue90WgAJJZMfTshN4OI8cq
W9E4EG9wglbEtMnObHlms8F3CHmrw3k6KmUkWGoa+/ENmcVl68u/cMRl1JbW2bM+
/3A+SAg2c6iPDlehczKx2oa95QW0SkPPWGuNA/CE8CpyANIhu9XFrj3RQ3EqeRcS
AQQod1RNuHpfETLU/A2gMmvn/w/sx7TB3W5BPs6rprOA37tutPq9u6FTZOcG1Oqj
C/B7yTqgI7rbyvox7DEXoX7rIiEqyNNUguTk/u3SZ4VXE2kmxdmSh3TQvybfbnXV
4JbCZVaqiZraqc7oZMnRoWrXRG3ztbnbes/9qhRGI7PqXqeKJBztxRTEVj8ONs1d
WN5szTwaPIvhkhO3CO5ErU2rVdUr89wKpNXbBODFKRtgxUT70YpmJ46VVaqdAhOZ
D9EUUn4YaeLaS8AjSF/h7UkjOibNc4qVDiPP+rkehFWM66PVnP1Msh93tc+taIfC
EYVMxjh8zNbFuoc7fzvvrFILLe7ifvEIUqSVIC/AzplM/Jxw7buXFeGP1qVCBEHq
391d/9RAfaZ12zkwFsl+IKwE/OZxW8AHa9i1p4GO0YSNuczzEm4=
-----END CERTIFICATE-----`;

const RU_SUB_CA = `-----BEGIN CERTIFICATE-----
MIIHQjCCBSqgAwIBAgICEAIwDQYJKoZIhvcNAQELBQAwcDELMAkGA1UEBhMCUlUx
PzA9BgNVBAoMNlRoZSBNaW5pc3RyeSBvZiBEaWdpdGFsIERldmVsb3BtZW50IGFu
ZCBDb21tdW5pY2F0aW9uczEgMB4GA1UEAwwXUnVzc2lhbiBUcnVzdGVkIFJvb3Qg
Q0EwHhcNMjIwMzAyMTEyNTE5WhcNMjcwMzA2MTEyNTE5WjBvMQswCQYDVQQGEwJS
VTE/MD0GA1UECgw2VGhlIE1pbmlzdHJ5IG9mIERpZ2l0YWwgRGV2ZWxvcG1lbnQg
YW5kIENvbW11bmljYXRpb25zMR8wHQYDVQQDDBZSdXNzaWFuIFRydXN0ZWQgU3Vi
IENBMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA9YPqBKOk19NFymrE
wehzrhBEgT2atLezpduB24mQ7CiOa/HVpFCDRZzdxqlh8drku408/tTmWzlNH/br
HuQhZ/miWKOf35lpKzjyBd6TPM23uAfJvEOQ2/dnKGGJbsUo1/udKSvxQwVHpVv3
S80OlluKfhWPDEXQpgyFqIzPoxIQTLZ0deirZwMVHarZ5u8HqHetRuAtmO2ZDGQn
vVOJYAjls+Hiueq7Lj7Oce7CQsTwVZeP+XQx28PAaEZ3y6sQEt6rL06ddpSdoTMp
BnCqTbxW+eWMyjkIn6t9GBtUV45yB1EkHNnj2Ex4GwCiN9T84QQjKSr+8f0psGrZ
vPbCbQAwNFJjisLixnjlGPLKa5vOmNwIh/LAyUW5DjpkCx004LPDuqPpFsKXNKpa
L2Dm6uc0x4Jo5m+gUTVORB6hOSzWnWDj2GWfomLzzyjG81DRGFBpco/O93zecsIN
3SL2Ysjpq1zdoS01CMYxie//9zWvYwzI25/OZigtnpCIrcd2j1Y6dMUFQAzAtHE+
qsXflSL8HIS+IJEFIQobLlYhHkoE3avgNx5jlu+OLYe0dF0Ykx1PGNjbwqvTX37R
Cn32NMjlotW2QcGEZhDKj+3urZizp5xdTPZitA+aEjZM/Ni71VOdiOP0igbw6asZ
2fxdozZ1TnSSYNYvNATwthNmZysCAwEAAaOCAeUwggHhMBIGA1UdEwEB/wQIMAYB
Af8CAQAwDgYDVR0PAQH/BAQDAgGGMB0GA1UdDgQWBBTR4XENCy2BTm6KSo9MI7NM
XqtpCzAfBgNVHSMEGDAWgBTh0YHlzlpfBKrS6badZrHF+qwshzCBxwYIKwYBBQUH
AQEEgbowgbcwOwYIKwYBBQUHMAKGL2h0dHA6Ly9yb3N0ZWxlY29tLnJ1L2NkcC9y
b290Y2Ffc3NsX3JzYTIwMjIuY3J0MDsGCCsGAQUFBzAChi9odHRwOi8vY29tcGFu
eS5ydC5ydS9jZHAvcm9vdGNhX3NzbF9yc2EyMDIyLmNydDA7BggrBgEFBQcwAoYv
aHR0cDovL3JlZXN0ci1wa2kucnUvY2RwL3Jvb3RjYV9zc2xfcnNhMjAyMi5jcnQw
gbAGA1UdHwSBqDCBpTA1oDOgMYYvaHR0cDovL3Jvc3RlbGVjb20ucnUvY2RwL3Jv
b3RjYV9zc2xfcnNhMjAyMi5jcmwwNaAzoDGGL2h0dHA6Ly9jb21wYW55LnJ0LnJ1
L2NkcC9yb290Y2Ffc3NsX3JzYTIwMjIuY3JsMDWgM6Axhi9odHRwOi8vcmVlc3Ry
LXBraS5ydS9jZHAvcm9vdGNhX3NzbF9yc2EyMDIyLmNybDANBgkqhkiG9w0BAQsF
AAOCAgEARBVzZls79AdiSCpar15dA5Hr/rrT4WbrOfzlpI+xrLeRPrUG6eUWIW4v
Sui1yx3iqGLCjPcKb+HOTwoRMbI6ytP/ndp3TlYua2advYBEhSvjs+4vDZNwXr/D
anbwIWdurZmViQRBDFebpkvnIvru/RpWud/5r624Wp8voZMRtj/cm6aI9LtvBfT9
cfzhOaexI/99c14dyiuk1+6QhdwKaCRTc1mdfNQmnfWNRbfWhWBlK3h4GGE9JK33
Gk8ZS8DMrkdAh0xby4xAQ/mSWAfWrBmfzlOqGyoB1U47WTOeqNbWkkoAP2ys94+s
Jg4NTkiDVtXRF6nr6fYi0bSOvOFg0IQrMXO2Y8gyg9ARdPJwKtvWX8VPADCYMiWH
h4n8bZokIrImVKLDQKHY4jCsND2HHdJfnrdL2YJw1qFskNO4cSNmZydw0Wkgjv9k
F+KxqrDKlB8MZu2Hclph6v/CZ0fQ9YuE8/lsHZ0Qc2HyiSMnvjgK5fDc3TD4fa8F
E8gMNurM+kV8PT8LNIM+4Zs+LKEV8nqRWBaxkIVJGekkVKO8xDBOG/aN62AZKHOe
GcyIdu7yNMMRihGVZCYr8rYiJoKiOzDqOkPkLOPdhtVlgnhowzHDxMHND/E2WA5p
ZHuNM/m0TXt2wTTPL7JH2YC0gPz/BvvSzjksgzU5rLbRyUKQkgU=
-----END CERTIFICATE-----`;

const MAX_API_BASE = 'platform-api2.max.ru';

// Универсальный вызов REST API MAX с правильными сертификатами.
function maxApi(method, path, body) {
    return new Promise((resolve, reject) => {
          const payload = body ? JSON.stringify(body) : null;
          const req = https.request(
            {
                      hostname: MAX_API_BASE,
                      path,
                      method,
                      headers: {
                                  Authorization: process.env.MAX_BOT_TOKEN,
                                  'Content-Type': 'application/json',
                                  ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
                      },
                      ca: [RU_ROOT_CA, RU_SUB_CA],
            },
                  (res) => {
                            let data = '';
                            res.on('data', (chunk) => { data += chunk; });
                            res.on('end', () => {
                                        let json = null;
                                        try { json = data ? JSON.parse(data) : null; } catch (e) { /* оставляем null */ }
                                        resolve({ status: res.statusCode, json, raw: data });
                            });
                  }
                );
          req.on('error', reject);
          if (payload) req.write(payload);
          req.end();
    });
}

const sendMessage = (chatId, text, keyboard) =>
    maxApi('POST', `/messages?chat_id=${chatId}`, {
          text,
          attachments: keyboard ? [{ type: 'inline_keyboard', payload: { buttons: keyboard } }] : undefined,
    });

const answerCallback = (callbackId, text, keyboard) =>
    maxApi('POST', `/answers?callback_id=${callbackId}`, {
          message: {
                  text,
                  attachments: keyboard ? [{ type: 'inline_keyboard', payload: { buttons: keyboard } }] : undefined,
          },
    });

// ---- Vercel KV (тот же REST-стиль, что уже используется в telegram-webhook.js) ----
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvSet(key, value, ttlSeconds) {
    const path = ttlSeconds
      ? `/set/${key}/${encodeURIComponent(value)}/EX/${ttlSeconds}`
          : `/set/${key}/${encodeURIComponent(value)}`;
    await fetch(`${KV_URL}${path}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
}

async function kvGet(key) {
    const r = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
    const data = await r.json();
    return data.result || null;
}

async function kvDel(key) {
    await fetch(`${KV_URL}/del/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
}

// SET ... NX: true, если ключ создан сейчас (раньше его не было). При сбое KV возвращаем true —
// лучше обработать событие дважды, чем потерять сообщение клиента.
async function kvSetNx(key, ttlSeconds) {
    try {
          const r = await fetch(`${KV_URL}/set/${key}/1/EX/${ttlSeconds}/NX`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
          const data = await r.json();
          return data.result === 'OK';
    } catch (e) {
          console.error('kvSetNx failed:', e);
          return true;
    }
}

// Телефон: 10 цифр (без кода страны) или 11 цифр, начинающихся с 7/8. Иначе null.
function normalizePhone(text) {
    const digits = (text || '').replace(/\D/g, '');
    let d = null;
    if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) d = digits.slice(1);
    else if (digits.length === 10) d = digits;
    if (!d) return null;
    return `+7 ${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

// «Имя (@username)» без пустых скобок, если username нет.
function who(name, username) {
    return username ? `${name} (${username})` : name;
}

// Текст похож на вопрос, а не на марку/модель авто.
function looksLikeQuestion(text) {
    return text.length > 60 || text.includes('?');
}

const CLIENT_ID_RE = /ID:\s*(-?\d+)/;

// ---- Данные точек и услуг — 1 в 1 с Telegram-ботом ----
const LOCATIONS = {
    a: { name: 'пр. Гагарина, 58/1В (ТРЦ Армада 2)', phone: '+7 (3532) 42-40-50' },
    k: { name: 'ул. Салмышская, 71 ст3 (ТРЦ «Кит»)', phone: '+7 (3532) 92-20-50' },
};

const SERVICES = {
    oil: 'Замена моторного масла',
    akpp: 'Замена масла в АКПП',
    mkpp: 'Замена масла в МКПП',
    gur: 'Замена жидкости ГУР',
    red: 'Замена редукторного масла',
    svech: 'Замена свечей зажигания',
    kolod: 'Замена тормозных колодок',
    other: 'Иное (уточню в сообщении)',
};

const DATES = {
    today: 'Сегодня',
    tomorrow: 'Завтра',
    week: 'На этой неделе',
};

function mainMenuKeyboard() {
    return [
          [{ type: 'callback', text: '📝 Записаться', payload: 'menu:book' }],
          [{ type: 'callback', text: '📞 Заказать звонок', payload: 'menu:call' }],
          [{ type: 'callback', text: '🔧 Подбор запчастей', payload: 'menu:parts' }],
        ];
}

function isSkip(text) {
    const t = text.trim();
    return t === '-' || /^нет$/i.test(t);
}

const backRow = () => [{ type: 'callback', text: '↩️ В начало', payload: 'menu:main' }];

function locationKeyboard(prefix) {
    return [
          [{ type: 'callback', text: 'Армада 2', payload: `${prefix}:a` }],
          [{ type: 'callback', text: 'КИТ', payload: `${prefix}:k` }],
          backRow(),
        ];
}

function serviceKeyboard(loc) {
    return [
      ...Object.entries(SERVICES).map(([code, label]) => [
        { type: 'callback', text: label, payload: `bk:svc:${loc}:${code}` },
          ]),
      backRow(),
        ];
}

function dateKeyboard(loc, svc) {
    return [
      ...Object.entries(DATES).map(([code, label]) => [
        { type: 'callback', text: label, payload: `bk:date:${loc}:${svc}:${code}` },
          ]),
      backRow(),
        ];
}

const WELCOME_TEXT =
    'Здравствуйте! Это Алекс-Авто — экспресс-замена масла в Оренбурге за 30 минут.\n\nЧто хотите сделать?';

const WORKING_HOURS_TEXT =
    'Здравствуйте! Это бот Алекс-Авто — в чате он вопросы не обсуждает.\n\n' +
    'Чтобы получить ответ, нажмите «Записаться» или «Заказать звонок» ниже — мы свяжемся с вами по телефону. ' +
    'Или позвоните сами (ежедневно с 09:00 до 21:00):\n\n' +
    `${LOCATIONS.a.name}: ${LOCATIONS.a.phone}\n${LOCATIONS.k.name}: ${LOCATIONS.k.phone}`;

// clientChatId дописывается строкой «ID: …» — по ней бот понимает, кому переслать ответ менеджера.
async function notifyAdmin(text, clientChatId) {
    const MAX_CHAT_ID = process.env.MAX_CHAT_ID;
    if (!MAX_CHAT_ID) return;
    const r = await sendMessage(MAX_CHAT_ID, clientChatId ? `${text}\n\nID: ${clientChatId}` : text);
    if (r.status < 200 || r.status >= 300) {
          console.error('MAX admin notify failed:', r.status, r.raw);
    }
}

function userName(user) {
    if (!user) return 'Гость';
    return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || user.username || 'Гость';
}

export default async function handler(req, res) {
    // ---- Диагностика / первичная настройка ----
  if (req.method === 'GET') {
        if (req.query.action === 'info') {
                const r = await maxApi('GET', '/me');
                return res.status(200).json({ step: 'me', status: r.status, body: r.json || r.raw });
        }
        if (req.query.action === 'subscribe') {
                const host = req.headers['x-forwarded-host'] || req.headers.host;
                const webhookUrl = `https://${host}/api/max-webhook`;
                const r = await maxApi('POST', '/subscriptions', {
                          url: webhookUrl,
                          update_types: ['message_created', 'message_callback', 'bot_started'],
                });
                return res.status(200).json({ step: 'subscribe', webhookUrl, status: r.status, body: r.json || r.raw });
        }
        if (req.query.action === 'unsubscribe') {
                const host = req.headers['x-forwarded-host'] || req.headers.host;
                const webhookUrl = `https://${host}/api/max-webhook`;
                const r = await maxApi('DELETE', `/subscriptions?url=${encodeURIComponent(webhookUrl)}`);
                return res.status(200).json({ step: 'unsubscribe', status: r.status, body: r.json || r.raw });
        }
        return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
        const update = req.body || {};
        const type = update.update_type;

      // --- Кнопка нажата ---
      if (type === 'message_callback') {
              const payload = update.callback?.payload || '';
              const chatId = update.message?.recipient?.chat_id;
              const fromName = userName(update.callback?.user);
              const fromUsername = update.callback?.user?.username ? `@${update.callback.user.username}` : '';
              const callbackId = update.callback?.callback_id;

          if (payload === 'menu:main') {
                    await kvDel(`max:wait:${chatId}`);
                    await answerCallback(callbackId, WELCOME_TEXT, mainMenuKeyboard());
          } else if (payload === 'menu:book') {
                    await answerCallback(callbackId, 'Выберите точку:', locationKeyboard('bk:loc'));
          } else if (payload === 'menu:call') {
                    await answerCallback(callbackId, 'Выберите точку:', locationKeyboard('call'));
          } else if (payload.startsWith('bk:loc:')) {
                    const loc = payload.split(':')[2];
                    await answerCallback(callbackId, `Точка: ${LOCATIONS[loc].name}\n\nВыберите услугу:`, serviceKeyboard(loc));
          } else if (payload.startsWith('bk:svc:')) {
                    const [, , loc, svc] = payload.split(':');
                    await answerCallback(callbackId, `Услуга: ${SERVICES[svc]}\n\nВыберите дату:`, dateKeyboard(loc, svc));
          } else if (payload.startsWith('bk:date:')) {
                    const [, , loc, svc, date] = payload.split(':');
                    await kvSet(`max:wait:${chatId}`, JSON.stringify({ kind: 'book_car', loc, svc, date }), 900);
                    await answerCallback(callbackId, 'Укажите марку и модель автомобиля — это поможет подготовить нужные масла и запчасти к визиту. Если не хотите указывать, отправьте "-".');
          } else if (payload.startsWith('call:')) {
                    const loc = payload.split(':')[1];
                    await kvSet(`max:wait:${chatId}`, JSON.stringify({ kind: 'call', loc }), 900);
                    await answerCallback(callbackId, `Точка: ${LOCATIONS[loc].name}\n\nНапишите, пожалуйста, номер телефона для связи:`);
          } else if (payload === 'menu:parts') {
                    await kvSet(`max:wait:${chatId}`, JSON.stringify({ kind: 'parts_car' }), 900);
                    await answerCallback(callbackId, 'Подбор и заказ запчастей (Совхозная) — для иномарок.\n\nУкажите марку и модель автомобиля:');
          }

          return res.status(200).json({ ok: true });
      }

      // --- Пользователь только что открыл бота ---
      if (type === 'bot_started') {
              const chatId = update.chat_id;
              await sendMessage(chatId, WELCOME_TEXT, mainMenuKeyboard());
              return res.status(200).json({ ok: true });
      }

      // --- Обычное текстовое сообщение ---
      if (type === 'message_created') {
              const chatId = update.message?.recipient?.chat_id;
              const text = (update.message?.body?.text || '').trim();
              const sender = update.message?.sender;
              const fromName = userName(sender);
              const fromUsername = sender?.username ? `@${sender.username}` : '';
              const fromLabel = who(fromName, fromUsername);

          // Сообщения ботов (в т.ч. свои собственные) не обрабатываем — защита от циклов
          if (sender?.is_bot) return res.status(200).json({ ok: true });

          // Дедупликация: одно и то же событие не обрабатываем дважды (повторные доставки вебхука)
          const mid = update.message?.body?.mid || `${chatId}:${update.message?.timestamp || update.timestamp}:${text.slice(0, 40)}`;
          if (!(await kvSetNx(`max:dup:${mid}`, 300))) {
                    return res.status(200).json({ ok: true });
          }

          // --- Сообщение из группы «Заявки»: ответ менеджера клиенту ---
          // Группа — это чат MAX_CHAT_ID. Писать в него могут только его участники.
          if (process.env.MAX_CHAT_ID && String(chatId) === String(process.env.MAX_CHAT_ID)) {
                    const link = update.message?.link;
                    console.log('MAX group message', { mid, linkType: link?.type || null, hasText: !!text });
                    // Не reply — никому не пересылаем и в группе не отвечаем
                    if (link?.type !== 'reply') return res.status(200).json({ ok: true });

                    const quoted = link.message?.text || link.message?.body?.text || '';
                    const match = quoted.match(CLIENT_ID_RE);
                    if (!match) {
                              await sendMessage(chatId, '⚠️ В сообщении, на которое вы отвечаете, нет строки «ID: …» — клиенту переслать нельзя. Отвечайте на уведомления «написал в MAX-боте» или «заявка» (заявки с сайта и старые уведомления ID не содержат).');
                              return res.status(200).json({ ok: true });
                    }
                    if (!text) {
                              await sendMessage(chatId, '⚠️ Пока пересылаю клиенту только текст — вложения и стикеры не передаются.');
                              return res.status(200).json({ ok: true });
                    }

                    const r = await sendMessage(match[1], text);
                    if (r.status >= 200 && r.status < 300) {
                              // Пока идёт диалог с менеджером, автоответ бота не нужен (6 часов)
                              await kvSet(`max:auto:${match[1]}`, '1', 21600);
                              await sendMessage(chatId, '✅ Отправлено клиенту');
                    } else {
                              console.error('MAX reply to client failed:', r.status, r.raw);
                              await sendMessage(chatId, `❌ Не доставлено (код ${r.status}). Возможно, клиент заблокировал бота или удалил чат.`);
                    }
                    return res.status(200).json({ ok: true });
          }

          const waitKey = `max:wait:${chatId}`;

          // Выход в главное меню из любого шага
          if (/^(\/start|\/menu|меню|в начало|отмена|отменить)$/i.test(text)) {
                    await kvDel(waitKey);
                    await sendMessage(chatId, WELCOME_TEXT, mainMenuKeyboard());
                    return res.status(200).json({ ok: true });
          }

          const waitingRaw = await kvGet(waitKey);

          if (waitingRaw) {
                    const waiting = JSON.parse(waitingRaw);
                    const keepWaiting = () => kvSet(waitKey, waitingRaw, 900); // остаёмся на том же шаге

                    // Вопрос вместо ответа на шаг: уходит менеджеру, шаг повторяется
                    const forwardQuestion = async () => {
                              await notifyAdmin(`💬 ${fromLabel} написал в MAX-боте:\n\n${text}`, chatId);
                    };
                    const needText = async (hint) => {
                              await keepWaiting();
                              await sendMessage(chatId, hint);
                              return res.status(200).json({ ok: true });
                    };
                    const needPhone = async () => {
                              await keepWaiting();
                              if (text && looksLikeQuestion(text)) await forwardQuestion();
                              await sendMessage(chatId, 'Не получилось распознать номер. Пожалуйста, укажите телефон в формате +7 900 123-45-67.\n\nЕсли хотите задать вопрос, просто напишите его — я передам менеджеру, но для заявки нужен номер. Вернуться в меню: напишите «меню».');
                              return res.status(200).json({ ok: true });
                    };
                    const needCar = async () => {
                              if (!text) return needText('Пожалуйста, напишите марку и модель автомобиля текстом (например: Chery Tiggo 7).');
                              await keepWaiting();
                              await forwardQuestion();
                              await sendMessage(chatId, 'Похоже, это вопрос — я передал его менеджеру, он ответит здесь. Чтобы продолжить, укажите марку и модель автомобиля (например: Chery Tiggo 7).');
                              return res.status(200).json({ ok: true });
                    };

                    if (waiting.kind === 'book_car') {
                              if (!text) return needText('Пожалуйста, напишите марку и модель автомобиля текстом (или "-", если не хотите указывать).');
                              if (!isSkip(text) && looksLikeQuestion(text)) {
                                        await keepWaiting();
                                        await forwardQuestion();
                                        await sendMessage(chatId, 'Похоже, это вопрос — я передал его менеджеру, он ответит здесь. Чтобы продолжить запись, укажите марку и модель автомобиля (например: Chery Tiggo 7) или отправьте "-".');
                                        return res.status(200).json({ ok: true });
                              }
                              const car = isSkip(text) ? '' : text;
                              await kvSet(waitKey, JSON.stringify({ ...waiting, kind: 'book', car }), 900);
                              await sendMessage(chatId, 'Укажите номер телефона для связи (например: +7 999 000-00-00)');
                              return res.status(200).json({ ok: true });
                    } else if (waiting.kind === 'book') {
                              const phone = normalizePhone(text);
                              if (!phone) return needPhone();
                              await kvDel(waitKey);
                              const locInfo = LOCATIONS[waiting.loc];
                              const svcLabel = SERVICES[waiting.svc];
                              const dateLabel = DATES[waiting.date];
                              const car = waiting.car;
                              await sendMessage(
                                            chatId,
                                            `✅ Заявка принята!\n📍 ${locInfo.name}\n🔧 ${svcLabel}\n📅 ${dateLabel}${car ? `\n🚗 ${car}` : ''}\n📞 ${phone}\n\nМы свяжемся с вами для подтверждения.`
                                          );
                              await notifyAdmin(
                                            `📝 ${fromLabel} заполнил заявку через MAX-бота\n\n` +
                                              `📍 Точка: ${locInfo.name}\n🔧 Услуга: ${svcLabel}\n📅 Дата: ${dateLabel}${car ? `\n🚗 Авто: ${car}` : ''}\n📞 Телефон: ${phone}`,
                                            chatId
                                          );
                    } else if (waiting.kind === 'call') {
                              const phone = normalizePhone(text);
                              if (!phone) return needPhone();
                              await kvDel(waitKey);
                              const locInfo = LOCATIONS[waiting.loc];
                              await sendMessage(chatId, `✅ Заявка на звонок принята!\n📍 ${locInfo.name}\n📞 ${phone}\n\nМы перезвоним вам в рабочее время.`);
                              await notifyAdmin(
                                            `📞 ${fromLabel} оставил заявку на звонок через MAX\n\n📍 Точка: ${locInfo.name}\n📞 Телефон: ${phone}`,
                                            chatId
                                          );
                    } else if (waiting.kind === 'parts_car') {
                              if (!text || looksLikeQuestion(text)) return needCar();
                              await kvSet(waitKey, JSON.stringify({ kind: 'parts_part', car: text }), 900);
                              await sendMessage(chatId, 'Укажите наименование нужной детали:');
                              return res.status(200).json({ ok: true });
                    } else if (waiting.kind === 'parts_part') {
                              if (!text) return needText('Пожалуйста, напишите наименование детали текстом.');
                              await kvSet(waitKey, JSON.stringify({ ...waiting, kind: 'parts_vin', part: text }), 900);
                              await sendMessage(chatId, 'Если знаете VIN — укажите, это ускорит подбор. Если не знаете, отправьте "-".');
                              return res.status(200).json({ ok: true });
                    } else if (waiting.kind === 'parts_vin') {
                              if (!text) return needText('Пожалуйста, напишите VIN текстом (или "-", если не знаете).');
                              const vin = isSkip(text) ? '' : text;
                              await kvSet(waitKey, JSON.stringify({ ...waiting, kind: 'parts_phone', vin }), 900);
                              await sendMessage(chatId, 'Укажите номер телефона для связи:');
                              return res.status(200).json({ ok: true });
                    } else if (waiting.kind === 'parts_phone') {
                              const phone = normalizePhone(text);
                              if (!phone) return needPhone();
                              await kvDel(waitKey);
                              const { car, part, vin } = waiting;
                              await sendMessage(
                                            chatId,
                                            `✅ Заявка на подбор запчасти принята!\n🚗 ${car}\n🔩 ${part}${vin ? `\n🔑 VIN: ${vin}` : ''}\n📞 ${phone}\n\nМы свяжемся с вами по наличию и цене.`
                                          );
                              await notifyAdmin(
                                            `🔩 ${fromLabel} запросил подбор запчасти через MAX\n\n` +
                                              `🚗 Авто: ${car}\n🔩 Деталь: ${part}${vin ? `\n🔑 VIN: ${vin}` : ''}\n📞 Телефон: ${phone}`,
                                            chatId
                                          );
                    }
                    return res.status(200).json({ ok: true });
          }

          // Свободное сообщение: пересылаем менеджеру (с ID для ответа), клиенту — автоответ + меню
          await notifyAdmin(`💬 ${fromLabel} написал в MAX-боте:\n\n${text || '[вложение или стикер без текста]'}`, chatId);
          // Автоответ не чаще раза в 30 минут и не во время диалога с менеджером
          if (await kvSetNx(`max:auto:${chatId}`, 1800)) {
                    await sendMessage(chatId, WORKING_HOURS_TEXT, mainMenuKeyboard());
          }
          return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });
  } catch (err) {
        console.error('MAX webhook error:', err);
        return res.status(200).json({ ok: true }); // MAX ждёт 200 в любом случае, ошибку просто логируем
  }
}
