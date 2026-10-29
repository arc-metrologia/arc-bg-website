/** Иконите на админ панела (в духа на Dashicons). 20×20, цветът идва от currentColor. */
const PATHS = {
  dashboard: 'M3 11a7 7 0 1 1 14 0h-2a5 5 0 0 0-10 0H3Zm6.3-.7 4-4 1.4 1.4-4 4a1.5 1.5 0 1 1-1.4-1.4ZM3 13h14v2H3z',
  posts: 'M4 3h9l3 3v11H4V3Zm2 4v1h8V7H6Zm0 3v1h8v-1H6Zm0 3v1h5v-1H6Z',
  products: 'M10 2 3 5.5v9L10 18l7-3.5v-9L10 2Zm0 2.2 4.6 2.3L10 8.8 5.4 6.5 10 4.2ZM5 8.1l4 2v5.6l-4-2V8.1Zm6 7.6v-5.6l4-2v5.6l-4 2Z',
  services: 'M13.6 2.5a4 4 0 0 0-4.9 5.2L2.8 13.6a1.6 1.6 0 0 0 2.3 2.3L11 10a4 4 0 0 0 5.2-4.9l-2.4 2.4-2-.5-.5-2 2.3-2.5Z',
  pages: 'M5 2h7l4 4v10H5V2Zm6 1.5V7h3.5L11 3.5ZM3 5h1v12h9v1H3V5Z',
  media: 'M3 4h14v12H3V4Zm2 2v8l3-4 2 2.5L12.5 9 15 14V6H5Zm2.5 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
  messages: 'M2 5h16v10H2V5Zm2 1.5 6 4.5 6-4.5V7l-6 4.5L4 7v-.5Z',
  appearance: 'M14.5 2.5 17.5 5.5 9 14l-3-3 8.5-8.5ZM5 12l3 3c-.5 2-2.5 3-5 3 1-1 .5-3 2-6Z',
  users: 'M7 9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm6.5 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5ZM1 16c0-3 2.7-5 6-5s6 2 6 5H1Zm13 0c0-1.6-.6-3-1.7-4 2.8-.3 5.7 1.2 5.7 4h-4Z',
  tools: 'M3 4h6v2H3V4Zm8 0h6v2h-6V4ZM3 9h14v2H3V9Zm0 5h9v2H3v-2Zm11 0h3v2h-3v-2Z',
  settings: 'M11 2l.4 2.1 1.5.6 1.8-1.2 1.8 1.8-1.2 1.8.6 1.5L18 9v2l-2.1.4-.6 1.5 1.2 1.8-1.8 1.8-1.8-1.2-1.5.6L11 18H9l-.4-2.1-1.5-.6-1.8 1.2-1.8-1.8 1.2-1.8-.6-1.5L2 11V9l2.1-.4.6-1.5-1.2-1.8 1.8-1.8 1.8 1.2 1.5-.6L9 2h2Zm-1 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  plus: 'M9 4h2v5h5v2h-5v5H9v-5H4V9h5V4Z',
  back: 'M12.5 4 14 5.5 9.5 10l4.5 4.5-1.5 1.5-6-6 6-6Z',
  sidebar: 'M3 3h14v14H3V3Zm2 2v10h6V5H5Zm8 0v10h2V5h-2Z',
  menu: 'M3 5h14v2H3V5Zm0 4h14v2H3V9Zm0 4h14v2H3v-2Z',
  collapse: 'M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm1.5 3.5L8 10l3.5 3.5V6.5Z',
  external: 'M11 3h6v6l-2.3-2.3-4.2 4.2-1.4-1.4 4.2-4.2L11 3ZM4 5h5v2H6v7h7v-3h2v5H4V5Z',
  close: 'M5.4 4 10 8.6 14.6 4 16 5.4 11.4 10l4.6 4.6-1.4 1.4-4.6-4.6L5.4 16 4 14.6 8.6 10 4 5.4 5.4 4Z',
  site: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm5.9 7a6 6 0 0 0-2.9-4.2c.6 1.2 1 2.6 1 4.2h1.9ZM12 9c-.1-2.3-1-4-2-4.9C9 5 8.1 6.7 8 9h4Zm-6 0c0-1.6.4-3 1-4.2A6 6 0 0 0 4.1 9H6Zm-1.9 2A6 6 0 0 0 7 15.2c-.6-1.2-1-2.6-1-4.2H4.1ZM8 11c.1 2.3 1 4 2 4.9 1-.9 1.9-2.6 2-4.9H8Zm6 0c0 1.6-.4 3-1 4.2a6 6 0 0 0 2.9-4.2H14Z',
} as const

export type IconName = keyof typeof PATHS

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="wp-icon" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  )
}
