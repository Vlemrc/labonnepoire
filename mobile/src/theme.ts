export const colors = {
  bg: "#12101A",
  surface: "#1C1926",
  surfaceHigh: "#262233",
  border: "#332E44",
  text: "#F3F0FA",
  textMuted: "#9A93AE",
  primary: "#F5C542",
  primaryText: "#231D10",
  danger: "#E8604C",
  success: "#4CC38A",
  info: "#6C8BF5",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const font = {
  title: { fontSize: 26, fontWeight: "800" },
  heading: { fontSize: 19, fontWeight: "700" },
  body: { fontSize: 16, fontWeight: "500" },
  label: { fontSize: 13, fontWeight: "600" },
  mono: { fontSize: 28, fontWeight: "800", letterSpacing: 4 },
} as const;
