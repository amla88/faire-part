// Généré à partir de palette.gpl
// Utilitaire simple pour réutiliser la palette côté TS (Phaser: tints)

export const palette = {
  blue: {
    900: 0x172038,
    700: 0x253a5e,
    500: 0x3c5e8b,
    300: 0x4f8fba,
    200: 0x73bed3,
    100: 0xa4dddb,
  },
  green: {
    900: 0x19332d,
    700: 0x25562e,
    500: 0x468232,
    400: 0x75a743,
    300: 0xa8ca58,
    200: 0xd0da91,
  },
  terra: {
    900: 0x4d2b32,
    700: 0x7a4841,
    500: 0xad7757,
    300: 0xc09473,
    200: 0xd7b594,
    100: 0xe7d5b3,
  },
  neutral: {
    950: 0x090a14,
    900: 0x10141f,
    800: 0x151d28,
    700: 0x202e37,
    600: 0x394a50,
    500: 0x577277,
    400: 0x819796,
    300: 0xa8b5b2,
    200: 0xc7cfcc,
    100: 0xebede9,
  },
} as const;

export type Palette = typeof palette;
