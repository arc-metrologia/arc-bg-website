import type { Lang } from './types'

const strings = {
  bg: {
    skip: 'Към съдържанието',
    menu: 'Меню',
    mainMenu: 'Основно меню',
    crumbs: 'Навигационна пътека',
    related: 'Свързани продукти и услуги',
    published: 'Публикувано',
    rights: 'Всички права запазени.',
    address: 'Адрес',
    phone: 'Телефон',
    email: 'Имейл',
    play: 'Пусни видеото',
    notFound: 'Страницата не е намерена',
    notFoundText: 'Адресът може да е променен. Опитайте от началната страница или ни се обадете.',
    loading: 'Зареждане…',
    form: {
      name: 'Име',
      company: 'Фирма',
      email: 'Имейл',
      phone: 'Телефон',
      message: 'Съобщение',
      send: 'Изпратете запитването',
      sending: 'Изпращане…',
      sent: 'Запитването е изпратено. Ще ви отговорим в рамките на работния ден.',
    },
    download: 'Изтегляне',
  },
  en: {
    skip: 'Skip to content',
    menu: 'Menu',
    mainMenu: 'Main menu',
    crumbs: 'Breadcrumb',
    related: 'Related products and services',
    published: 'Published',
    rights: 'All rights reserved.',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    play: 'Play video',
    notFound: 'Page not found',
    notFoundText: 'The address may have changed. Start from the home page or give us a call.',
    loading: 'Loading…',
    form: {
      name: 'Name',
      company: 'Company',
      email: 'Email',
      phone: 'Phone',
      message: 'Message',
      send: 'Send enquiry',
      sending: 'Sending…',
      sent: 'Your enquiry has been sent. We will reply within the working day.',
    },
    download: 'Download',
  },
}

export type Strings = (typeof strings)['bg']
export const t = (lang: Lang): Strings => strings[lang] ?? strings.bg

export function langFromPath(pathname: string): { lang: Lang; path: string } {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
  if (parts[0] === 'en') return { lang: 'en', path: parts.slice(1).join('/') }
  return { lang: 'bg', path: parts.join('/') }
}
