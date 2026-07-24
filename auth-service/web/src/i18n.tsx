import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Locale = 'ru' | 'en';

const STORAGE_LOCALE = 'storyweaver_locale';

type Dict = Record<string, string>;

const ru: Dict = {
  'nav.download': 'Скачать',
  'nav.subscribe': 'Подписка',
  'nav.account': 'Кабинет',
  'nav.login': 'Войти',
  'nav.register': 'Регистрация',
  'nav.logout': 'Выйти',
  'footer.auth': 'Вход: Telegram (Tribute) или email на сайте',

  'home.brand': 'StoryWeaver',
  'home.title': 'Профессиональное приложение для писателей',
  'home.lead': 'Редактор глав, база мира, MindMap и таймлайн — офлайн, на вашем компьютере.',
  'home.download': 'Скачать приложение',
  'home.login': 'Войти (Telegram / email)',
  'home.features': 'Возможности',
  'home.featuresLead': 'Тот же инструмент, что в десктопном приложении.',
  'home.f1.title': 'Редактор глав',
  'home.f1.text': 'Написание и редактирование текста с автосохранением, фокус-режимом и экспортом.',
  'home.f2.title': 'База мира',
  'home.f2.text': 'Персонажи, локации, предметы, фракции и лор — рядом с текстом книги.',
  'home.f3.title': 'MindMap и таймлайн',
  'home.f3.text': 'Планировщик сюжета и хронология событий в одном приложении.',
  'home.f4.title': 'Офлайн',
  'home.f4.text': 'Данные локально в SQLite. Проект — папка на вашем диске.',
  'home.sub.title': 'Подписка',
  'home.sub.lead':
    'Купили через Tribute — войдите через Telegram, чтобы увидеть статус и скачать приложение. Можно также создать отдельный аккаунт на сайте.',
  'home.sub.steps': 'Tribute → вход через Telegram → кабинет и скачивание. Либо регистрация email на сайте.',
  'home.sub.tg': 'Войти через Telegram',
  'home.sub.plans': 'Тарифы сайта',

  'download.title': 'Скачать',
  'download.lead': 'Десктопное приложение StoryWeaver. Обновления приходят автоматически.',
  'download.loading': 'Загрузка…',
  'download.version': 'Версия',
  'download.for': 'Скачать для',
  'download.releases': 'Открыть релизы',
  'download.all': 'Все файлы',
  'download.github': 'Открыть релизы на GitHub',
  'download.os.windows': 'Windows',
  'download.os.mac': 'macOS',
  'download.os.linux': 'Linux',
  'download.os.other': 'ваша ОС',

  'login.title': 'Вход',
  'login.lead': 'Подписка Tribute — через Telegram. Аккаунт сайта — email.',
  'login.tg': 'Войти через Telegram (Tribute)',
  'login.tg.loading': 'Откройте Telegram…',
  'login.tg.need': 'Нужна активная подписка Tribute и канал',
  'login.qr': 'Отсканируйте QR или откройте ссылку в Telegram',
  'login.openBot': 'Открыть бота',
  'login.cancel': 'Отмена',
  'login.orEmail': 'или email',
  'login.email': 'Email',
  'login.password': 'Пароль',
  'login.submit': 'Войти по email',
  'login.submitting': 'Вход…',
  'login.noAccount': 'Нет аккаунта сайта?',
  'login.register': 'Регистрация',
  'login.timeout': 'Время вышло. Попробуйте снова.',
  'login.qrFail': 'Не удалось сгенерировать QR-код',
  'login.fail': 'Не удалось войти',
  'login.network': 'Ошибка сети',

  'register.title': 'Регистрация',
  'register.lead': 'Создайте аккаунт на сайте. После регистрации подтвердите email.',
  'register.name': 'Имя (необязательно)',
  'register.email': 'Email',
  'register.password': 'Пароль (мин. 8 символов)',
  'register.passwordConfirm': 'Подтвердите пароль',
  'register.submit': 'Создать аккаунт',
  'register.submitting': 'Создание…',
  'register.haveAccount': 'Уже есть аккаунт?',
  'register.login': 'Войти',
  'register.fail': 'Не удалось зарегистрироваться',
  'register.network': 'Ошибка сети',
  'register.mismatch': 'Пароли не совпадают',
  'register.checkEmail': 'Проверьте почту',
  'register.checkEmailBody':
    'Мы отправили письмо на {email}. Откройте ссылку в письме, чтобы подтвердить аккаунт.',
  'register.resend': 'Отправить письмо снова',
  'register.resendOk': 'Письмо отправлено снова',
  'register.resendFail': 'Не удалось отправить письмо',
  'login.verifyOk': 'Email подтверждён. Теперь можно войти.',
  'login.verifyFail': 'Не удалось подтвердить email. Запросите письмо снова.',
  'login.resend': 'Отправить письмо подтверждения',

  'account.title': 'Кабинет',
  'account.lead.tg': 'Вход через Telegram · подписка Tribute',
  'account.lead.email': 'Аккаунт сайта StoryWeaver',
  'account.loading': 'Загрузка кабинета…',
  'account.tgId': 'Telegram ID',
  'account.email': 'Email',
  'account.name': 'Имя',
  'account.sub': 'Подписка',
  'account.active': 'Активна',
  'account.inactive': 'Не активна',
  'account.plan': 'Тариф / источник',
  'account.until': 'Действует до',
  'account.untilOpen': 'бессрочно / по правилам Tribute',
  'account.status': 'Статус',
  'account.download': 'Скачать приложение',
  'account.channel': 'Канал подписки',
  'account.extend': 'Продлить подписку',
  'account.buy': 'Оформить подписку',
  'account.tgHint':
    'Оплатите подписку в Tribute, затем вступите в канал и обновите страницу (или войдите снова).',

  'subscribe.title': 'Подписка на сайте',
  'subscribe.lead':
    'Оформите доступ email-аккаунтом. Пробный период при регистрации — {days} дн. Если оплатили через Tribute — войдите через Telegram. Цены в USD.',
  'subscribe.loading': 'Загрузка…',
  'subscribe.buy': 'Оформить',
  'subscribe.buying': 'Оформление…',
  'subscribe.account': 'В кабинет',
  'subscribe.tgLogin': 'Вход через Telegram',
  'subscribe.tg.title': 'Подписка Tribute',
  'subscribe.tg.lead':
    'Вы вошли через Telegram. Продление и статус оплаты — в Tribute и канале.',
  'subscribe.tg.body': 'В кабинете можно посмотреть, активна ли подписка, и скачать приложение.',
  'subscribe.tg.channel': 'Открыть канал',
  'subscribe.orderFail': 'Не удалось создать заказ',
  'subscribe.network': 'Ошибка сети',
  'subscribe.currency': 'USD',

  'plan.monthly.name': 'Месяц',
  'plan.monthly.desc': 'Полный доступ к StoryWeaver на 30 дней',
  'plan.yearly.name': 'Год',
  'plan.yearly.desc': 'Полный доступ на год — выгоднее примерно на 17%',

  'admin.title': 'Админ-панель',
  'admin.lead': 'Введите ADMIN_TOKEN с сервера (Railway).',
  'admin.token': 'Admin token',
  'admin.unlock': 'Войти',
  'admin.logout': 'Выйти',
  'admin.refresh': 'Обновить',
  'admin.refreshing': 'Обновление…',
  'admin.updated': 'Обновлено',
  'admin.unauthorized': 'Неверный токен',
  'admin.network': 'Ошибка сети',
  'admin.website': 'Сайт',
  'admin.websiteLead': 'Регистрации, email-подтверждения, заказы и подписки сайта.',
  'admin.telegram': 'Telegram / Tribute',
  'admin.telegramLead': 'Подписчики из webhook Tribute, API и канала',
  'admin.users': 'Пользователи',
  'admin.verified': 'Email подтверждён',
  'admin.unverified': 'Email не подтверждён',
  'admin.subActive': 'Подписка активна',
  'admin.subTrial': 'Пробный период',
  'admin.subPending': 'Ждут подтверждения',
  'admin.ordersPaid': 'Оплаченные заказы',
  'admin.ordersPending': 'Ожидают оплаты',
  'admin.revenue': 'Выручка (paid)',
  'admin.tgTotal': 'Всего в базе',
  'admin.tgActive': 'Активны',
  'admin.tgExpired': 'Неактивны / истекли',
  'admin.tgCancelled': 'Отменены (статус)',
  'admin.tgSources': 'По источникам',
  'admin.recentUsers': 'Последние регистрации',
  'admin.recentOrders': 'Последние заказы',
  'admin.recentTg': 'Последние Telegram-подписчики',
  'admin.empty': 'Пока нет данных',
  'admin.health.mail': 'Почта',
  'admin.health.tribute': 'Tribute API',
  'admin.health.admin': 'ADMIN_TOKEN',
  'admin.col.verified': 'Email',
  'admin.col.plan': 'Тариф',
  'admin.col.status': 'Статус',
  'admin.col.created': 'Создан',
  'admin.col.amount': 'Сумма',
  'admin.col.source': 'Источник',
  'admin.col.until': 'До',
  'admin.col.updated': 'Обновлён',

  'admin.grantTitle': 'Выдать подписку',
  'admin.grantLead': 'Активирует доступ для email-аккаунта сайта (продлевает, если уже есть срок).',
  'admin.grantCustom': 'Свой срок (дни)',
  'admin.grantDays': 'Дней',
  'admin.grantSubmit': 'Выдать',
  'admin.grantOk': 'Подписка выдана',
  'admin.grantFail': 'Не удалось выдать подписку',
  'admin.working': 'Сохранение…',

  'admin.refTitle': 'Реферальные коды',
  'admin.refLead': 'Скидка на оплату на сайте. Учитываются использования и сумма оплаченных заказов.',
  'admin.refCode': 'Код',
  'admin.refDiscount': 'Скидка %',
  'admin.refMaxUses': 'Лимит использований (пусто = без лимита)',
  'admin.refNote': 'Заметка (необязательно)',
  'admin.refCreate': 'Создать код',
  'admin.refOk': 'Код создан',
  'admin.refFail': 'Не удалось сохранить код',
  'admin.refTotal': 'Кодов',
  'admin.refActive': 'Активных',
  'admin.refUses': 'Использований',
  'admin.refPaidUses': 'Оплат',
  'admin.refRevenue': 'Оплачено USD',
  'admin.refDisable': 'Выкл',
  'admin.refEnable': 'Вкл',

  'subscribe.referral': 'Реферальный / промокод',
  'subscribe.referralPh': 'Например PARTNER10',
};

const en: Dict = {
  'nav.download': 'Download',
  'nav.subscribe': 'Subscribe',
  'nav.account': 'Account',
  'nav.login': 'Sign in',
  'nav.register': 'Sign up',
  'nav.logout': 'Sign out',
  'footer.auth': 'Sign in: Telegram (Tribute) or website email',

  'home.brand': 'StoryWeaver',
  'home.title': 'A professional app for writers',
  'home.lead': 'Chapter editor, world bible, MindMap and timeline — offline, on your computer.',
  'home.download': 'Download the app',
  'home.login': 'Sign in (Telegram / email)',
  'home.features': 'Features',
  'home.featuresLead': 'The same tool as in the desktop app.',
  'home.f1.title': 'Chapter editor',
  'home.f1.text': 'Write and edit with autosave, focus mode, and export.',
  'home.f2.title': 'World bible',
  'home.f2.text': 'Characters, locations, items, factions, and lore next to your manuscript.',
  'home.f3.title': 'MindMap & timeline',
  'home.f3.text': 'Plot planning and event chronology in one place.',
  'home.f4.title': 'Offline-first',
  'home.f4.text': 'Data stays in local SQLite. A project is a folder on your disk.',
  'home.sub.title': 'Subscription',
  'home.sub.lead':
    'Bought via Tribute? Sign in with Telegram to see status and download the app. Or create a separate website account.',
  'home.sub.steps': 'Tribute → Telegram sign-in → account & download. Or register with email on the site.',
  'home.sub.tg': 'Sign in with Telegram',
  'home.sub.plans': 'Website plans',

  'download.title': 'Download',
  'download.lead': 'StoryWeaver desktop app. Updates arrive automatically.',
  'download.loading': 'Loading…',
  'download.version': 'Version',
  'download.for': 'Download for',
  'download.releases': 'Open releases',
  'download.all': 'All files',
  'download.github': 'Open releases on GitHub',
  'download.os.windows': 'Windows',
  'download.os.mac': 'macOS',
  'download.os.linux': 'Linux',
  'download.os.other': 'your OS',

  'login.title': 'Sign in',
  'login.lead': 'Tribute subscription — via Telegram. Website account — email.',
  'login.tg': 'Sign in with Telegram (Tribute)',
  'login.tg.loading': 'Open Telegram…',
  'login.tg.need': 'Active Tribute subscription and channel required',
  'login.qr': 'Scan the QR code or open the link in Telegram',
  'login.openBot': 'Open bot',
  'login.cancel': 'Cancel',
  'login.orEmail': 'or email',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Sign in with email',
  'login.submitting': 'Signing in…',
  'login.noAccount': 'No website account?',
  'login.register': 'Sign up',
  'login.timeout': 'Timed out. Try again.',
  'login.qrFail': 'Could not generate QR code',
  'login.fail': 'Could not sign in',
  'login.network': 'Network error',

  'register.title': 'Sign up',
  'register.lead': 'Create a website account. You will need to confirm your email.',
  'register.name': 'Name (optional)',
  'register.email': 'Email',
  'register.password': 'Password (min. 8 characters)',
  'register.passwordConfirm': 'Confirm password',
  'register.submit': 'Create account',
  'register.submitting': 'Creating…',
  'register.haveAccount': 'Already have an account?',
  'register.login': 'Sign in',
  'register.fail': 'Could not register',
  'register.network': 'Network error',
  'register.mismatch': 'Passwords do not match',
  'register.checkEmail': 'Check your email',
  'register.checkEmailBody':
    'We sent a message to {email}. Open the link in the email to confirm your account.',
  'register.resend': 'Resend email',
  'register.resendOk': 'Email sent again',
  'register.resendFail': 'Could not send email',
  'login.verifyOk': 'Email confirmed. You can sign in now.',
  'login.verifyFail': 'Could not confirm email. Request a new link.',
  'login.resend': 'Resend confirmation email',

  'account.title': 'Account',
  'account.lead.tg': 'Signed in with Telegram · Tribute subscription',
  'account.lead.email': 'StoryWeaver website account',
  'account.loading': 'Loading account…',
  'account.tgId': 'Telegram ID',
  'account.email': 'Email',
  'account.name': 'Name',
  'account.sub': 'Subscription',
  'account.active': 'Active',
  'account.inactive': 'Inactive',
  'account.plan': 'Plan / source',
  'account.until': 'Valid until',
  'account.untilOpen': 'open-ended / per Tribute rules',
  'account.status': 'Status',
  'account.download': 'Download the app',
  'account.channel': 'Subscription channel',
  'account.extend': 'Renew subscription',
  'account.buy': 'Get a subscription',
  'account.tgHint':
    'Pay in Tribute, join the channel, then refresh this page (or sign in again).',

  'subscribe.title': 'Website subscription',
  'subscribe.lead':
    'Get access with an email account. Trial after signup: {days} days. Paid via Tribute? Sign in with Telegram. Prices are in USD.',
  'subscribe.loading': 'Loading…',
  'subscribe.buy': 'Subscribe',
  'subscribe.buying': 'Processing…',
  'subscribe.account': 'Account',
  'subscribe.tgLogin': 'Telegram sign-in',
  'subscribe.tg.title': 'Tribute subscription',
  'subscribe.tg.lead': 'You signed in with Telegram. Renewals and billing stay in Tribute and the channel.',
  'subscribe.tg.body': 'In your account you can check status and download the app.',
  'subscribe.tg.channel': 'Open channel',
  'subscribe.orderFail': 'Could not create order',
  'subscribe.network': 'Network error',
  'subscribe.currency': 'USD',

  'plan.monthly.name': 'Monthly',
  'plan.monthly.desc': 'Full StoryWeaver access for 30 days',
  'plan.yearly.name': 'Yearly',
  'plan.yearly.desc': 'Full access for a year — about 17% cheaper',

  'admin.title': 'Admin panel',
  'admin.lead': 'Enter the server ADMIN_TOKEN (Railway).',
  'admin.token': 'Admin token',
  'admin.unlock': 'Unlock',
  'admin.logout': 'Sign out',
  'admin.refresh': 'Refresh',
  'admin.refreshing': 'Refreshing…',
  'admin.updated': 'Updated',
  'admin.unauthorized': 'Invalid token',
  'admin.network': 'Network error',
  'admin.website': 'Website',
  'admin.websiteLead': 'Signups, email verification, orders, and site subscriptions.',
  'admin.telegram': 'Telegram / Tribute',
  'admin.telegramLead': 'Subscribers from Tribute webhook, API, and channel',
  'admin.users': 'Users',
  'admin.verified': 'Email verified',
  'admin.unverified': 'Email unverified',
  'admin.subActive': 'Active subscriptions',
  'admin.subTrial': 'Trial',
  'admin.subPending': 'Pending verification',
  'admin.ordersPaid': 'Paid orders',
  'admin.ordersPending': 'Pending orders',
  'admin.revenue': 'Revenue (paid)',
  'admin.tgTotal': 'Total stored',
  'admin.tgActive': 'Active',
  'admin.tgExpired': 'Inactive / expired',
  'admin.tgCancelled': 'Cancelled (status)',
  'admin.tgSources': 'By source',
  'admin.recentUsers': 'Recent signups',
  'admin.recentOrders': 'Recent orders',
  'admin.recentTg': 'Recent Telegram subscribers',
  'admin.empty': 'No data yet',
  'admin.health.mail': 'Mail',
  'admin.health.tribute': 'Tribute API',
  'admin.health.admin': 'ADMIN_TOKEN',
  'admin.col.verified': 'Email',
  'admin.col.plan': 'Plan',
  'admin.col.status': 'Status',
  'admin.col.created': 'Created',
  'admin.col.amount': 'Amount',
  'admin.col.source': 'Source',
  'admin.col.until': 'Until',
  'admin.col.updated': 'Updated',

  'admin.grantTitle': 'Grant subscription',
  'admin.grantLead': 'Activates access for a website email account (extends if already active).',
  'admin.grantCustom': 'Custom length (days)',
  'admin.grantDays': 'Days',
  'admin.grantSubmit': 'Grant',
  'admin.grantOk': 'Subscription granted',
  'admin.grantFail': 'Could not grant subscription',
  'admin.working': 'Saving…',

  'admin.refTitle': 'Referral codes',
  'admin.refLead': 'Checkout discount codes. Tracks uses and paid revenue.',
  'admin.refCode': 'Code',
  'admin.refDiscount': 'Discount %',
  'admin.refMaxUses': 'Max uses (empty = unlimited)',
  'admin.refNote': 'Note (optional)',
  'admin.refCreate': 'Create code',
  'admin.refOk': 'Code created',
  'admin.refFail': 'Could not save code',
  'admin.refTotal': 'Codes',
  'admin.refActive': 'Active',
  'admin.refUses': 'Uses',
  'admin.refPaidUses': 'Paid checkouts',
  'admin.refRevenue': 'Paid USD',
  'admin.refDisable': 'Off',
  'admin.refEnable': 'On',

  'subscribe.referral': 'Referral / promo code',
  'subscribe.referralPh': 'e.g. PARTNER10',
};

const DICTS: Record<Locale, Dict> = { ru, en };

function detectLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_LOCALE);
  if (saved === 'ru' || saved === 'en') return saved;
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('ru') ? 'ru' : 'en';
}

type I18nCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nCtx | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_LOCALE, l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICTS[locale][key] ?? DICTS.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{${k}}`, String(v));
        }
      }
      return s;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n outside LocaleProvider');
  return ctx;
}

export function formatUsd(amount: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
