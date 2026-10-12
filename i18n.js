export const LANGS = { ru: 'Русский', tg: 'Тоҷикӣ', uz: 'Oʻzbekcha' };
export const DEFAULT_LANG = 'ru';

export const T = {
  ru: {
    app: 'Ассистент для соцсетей', tagline: 'Подключите ассистента к Instagram, Telegram и WhatsApp — он будет отвечать вашим клиентам.',
    register: 'Регистрация', login: 'Войти', logout: 'Выйти', name: 'Ваше имя', email: 'Эл. почта', password: 'Пароль (не короче 8 символов)',
    terms: 'Я принимаю условия и политику конфиденциальности', create: 'Создать аккаунт', haveAcc: 'Уже есть аккаунт?', noAcc: 'Нет аккаунта?',
    hello: 'Здравствуйте', cabinet: 'Личный кабинет', statusLabel: 'Статус',
    status_awaiting_payment: 'Ожидает оплаты', status_paid: 'Оплата подтверждена', status_active: 'Ассистент работает', status_paused: 'На паузе',
    nextStep: 'Следующий шаг: оплата подключения (300 сомони). Эта часть появится в следующем обновлении.',
    install: 'Добавить на главный экран', iosHint: 'На iPhone: нажмите «Поделиться» → «На экран Домой».',
    errName: 'Введите имя', errEmail: 'Проверьте эл. почту', errPass: 'Пароль слишком короткий', errTerms: 'Нужно принять условия',
    errExists: 'Этот адрес уже зарегистрирован', errCreds: 'Неверная почта или пароль', errLimit: 'Слишком много попыток. Подождите 15 минут.', errGeneric: 'Что-то пошло не так. Попробуйте ещё раз.',
    notFound: 'Страница не найдена', back: 'На главную',
  },
  tg: {
    app: 'Ёрдамчӣ барои шабакаҳои иҷтимоӣ', tagline: 'Ёрдамчиро ба Instagram, Telegram ва WhatsApp пайваст кунед — ӯ ба муштариёни шумо ҷавоб медиҳад.',
    register: 'Сабти ном', login: 'Даромадан', logout: 'Баромадан', name: 'Номи шумо', email: 'Почтаи электронӣ', password: 'Рамз (на кам аз 8 аломат)',
    terms: 'Ман шартҳо ва сиёсати махфиятро қабул мекунам', create: 'Сохтани ҳисоб', haveAcc: 'Ҳисоб доред?', noAcc: 'Ҳисоб надоред?',
    hello: 'Салом', cabinet: 'Кабинети шахсӣ', statusLabel: 'Ҳолат',
    status_awaiting_payment: 'Пардохт интизор аст', status_paid: 'Пардохт тасдиқ шуд', status_active: 'Ёрдамчӣ кор мекунад', status_paused: 'Дар таваққуф',
    nextStep: 'Қадами навбатӣ: пардохти пайвастшавӣ (300 сомонӣ). Ин қисм дар навсозии оянда пайдо мешавад.',
    install: 'Илова ба экрани асосӣ', iosHint: 'Дар iPhone: «Мубодила» → «Ба экрани асосӣ» -ро пахш кунед.',
    errName: 'Номро ворид кунед', errEmail: 'Почтаро санҷед', errPass: 'Рамз хеле кӯтоҳ аст', errTerms: 'Шартҳоро бояд қабул кард',
    errExists: 'Ин суроға аллакай сабт шудааст', errCreds: 'Почта ё рамз нодуруст аст', errLimit: 'Кӯшишҳо аз ҳад зиёд. 15 дақиқа интизор шавед.', errGeneric: 'Хатогӣ рух дод. Бори дигар кӯшиш кунед.',
    notFound: 'Саҳифа ёфт нашуд', back: 'Ба саҳифаи асосӣ',
  },
  uz: {
    app: 'Ijtimoiy tarmoqlar uchun yordamchi', tagline: 'Yordamchini Instagram, Telegram va WhatsApp’ga ulang — u mijozlaringizga javob beradi.',
    register: 'Roʻyxatdan oʻtish', login: 'Kirish', logout: 'Chiqish', name: 'Ismingiz', email: 'Elektron pochta', password: 'Parol (kamida 8 belgi)',
    terms: 'Men shartlar va maxfiylik siyosatini qabul qilaman', create: 'Hisob yaratish', haveAcc: 'Hisobingiz bormi?', noAcc: 'Hisobingiz yoʻqmi?',
    hello: 'Assalomu alaykum', cabinet: 'Shaxsiy kabinet', statusLabel: 'Holat',
    status_awaiting_payment: 'Toʻlov kutilmoqda', status_paid: 'Toʻlov tasdiqlandi', status_active: 'Yordamchi ishlayapti', status_paused: 'Pauzada',
    nextStep: 'Keyingi qadam: ulanish uchun toʻlov (300 somoniy). Bu qism keyingi yangilanishda paydo boʻladi.',
    install: 'Bosh ekranga qoʻshish', iosHint: 'iPhone’da: «Ulashish» → «Bosh ekranga» tugmasini bosing.',
    errName: 'Ismni kiriting', errEmail: 'Pochtani tekshiring', errPass: 'Parol juda qisqa', errTerms: 'Shartlarni qabul qilish kerak',
    errExists: 'Bu manzil allaqachon roʻyxatdan oʻtgan', errCreds: 'Pochta yoki parol notoʻgʻri', errLimit: 'Urinishlar juda koʻp. 15 daqiqa kuting.', errGeneric: 'Xatolik yuz berdi. Qayta urinib koʻring.',
    notFound: 'Sahifa topilmadi', back: 'Bosh sahifaga',
  },
};

export const pickLang = (v) => (v && T[v] ? v : DEFAULT_LANG);
