import { alpha, createTheme, type PaletteMode } from "@mui/material/styles";

function buildTheme(mode: PaletteMode) {
    const isDark = mode === "dark";
    const ink = "#0C0A09";
    const warmInk = "#292524";
    const body = "#4E4E4E";
    const muted = "#777169";
    const hairline = "#E7E5E4";
    const canvas = "#F5F5F5";
    const canvasSoft = "#FAFAFA";
    const surfaceStrong = "#F0EFED";
    const success = "#16A34A";
    const error = "#DC2626";

    const theme = createTheme({
        palette: {
            mode,
            primary: {
                main: warmInk,
                light: "#57534E",
                dark: ink,
                contrastText: "#FFFFFF",
            },
            secondary: {
                main: isDark ? "#A8A29E" : muted,
                light: isDark ? canvas : "#A8A29E",
                dark: isDark ? hairline : warmInk,
            },
            success: {
                main: isDark ? "#86EFAC" : success,
            },
            warning: {
                main: isDark ? "#F4C5A8" : "#B45309",
            },
            error: {
                main: isDark ? "#FCA5A5" : error,
            },
            background: {
                default: isDark ? ink : canvas,
                paper: isDark ? "#1C1917" : "#FFFFFF",
            },
            text: {
                primary: isDark ? canvas : ink,
                secondary: isDark ? "#D6D3D1" : body,
            },
            divider: isDark ? alpha(hairline, 0.14) : hairline,
        },
        shape: {
            borderRadius: 8,
        },
        typography: {
            fontFamily: '"Manrope", "Segoe UI", sans-serif',
            h1: {
                fontFamily: '"Georgia", "Times New Roman", serif',
                fontSize: "clamp(2.25rem, 5vw, 4rem)",
                fontWeight: 300,
                letterSpacing: "0",
                lineHeight: 1.05,
            },
            h2: {
                fontFamily: '"Georgia", "Times New Roman", serif',
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 300,
                letterSpacing: "0",
                lineHeight: 1.08,
            },
            h3: {
                fontFamily: '"Georgia", "Times New Roman", serif',
                fontSize: "clamp(1.8rem, 3vw, 2.25rem)",
                fontWeight: 300,
                letterSpacing: "0",
                lineHeight: 1.13,
            },
            h4: {
                fontFamily: '"Georgia", "Times New Roman", serif',
                fontSize: "clamp(1.45rem, 2vw, 1.9rem)",
                fontWeight: 300,
                letterSpacing: "0",
                lineHeight: 1.18,
            },
            h5: {
                fontSize: "1.25rem",
                fontWeight: 500,
                letterSpacing: "0",
                lineHeight: 1.3,
            },
            h6: {
                fontSize: "1.05rem",
                fontWeight: 500,
                letterSpacing: "0",
                lineHeight: 1.3,
            },
            subtitle1: {
                fontSize: "0.98rem",
                fontWeight: 500,
                letterSpacing: "0",
            },
            subtitle2: {
                fontSize: "0.87rem",
                fontWeight: 500,
                letterSpacing: "0.01em",
            },
            body1: {
                fontSize: "0.98rem",
                lineHeight: 1.6,
                letterSpacing: "0.01em",
            },
            body2: {
                fontSize: "0.9rem",
                lineHeight: 1.6,
                letterSpacing: "0.01em",
            },
            button: {
                fontSize: "0.95rem",
                fontWeight: 500,
                letterSpacing: "0",
                textTransform: "none",
            },
            overline: {
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
            },
            caption: {
                fontSize: "0.78rem",
                lineHeight: 1.45,
            },
        },
    });

    return createTheme(theme, {
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    ":root": {
                        colorScheme: mode,
                    },
                    "*, *::before, *::after": {
                        boxSizing: "border-box",
                    },
                    html: {
                        minHeight: "100%",
                        scrollBehavior: "smooth",
                    },
                    body: {
                        minHeight: "100vh",
                        margin: 0,
                        backgroundColor: theme.palette.background.default,
                        backgroundImage: isDark
                            ? "linear-gradient(180deg, #0C0A09 0%, #1C1917 100%)"
                            : `linear-gradient(180deg, ${canvas} 0%, ${canvasSoft} 100%)`,
                        color: theme.palette.text.primary,
                        textRendering: "optimizeLegibility",
                        WebkitFontSmoothing: "antialiased",
                        MozOsxFontSmoothing: "grayscale",
                    },
                    "#root": {
                        minHeight: "100vh",
                    },
                    "::selection": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.22),
                    },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundImage: "none",
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: "none",
                    },
                    rounded: {
                        borderRadius: 16,
                    },
                },
            },
            MuiCard: {
                defaultProps: {
                    elevation: 0,
                },
                styleOverrides: {
                    root: {
                        borderRadius: 16,
                        border: `1px solid ${theme.palette.divider}`,
                        backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.88 : 0.96),
                        boxShadow: isDark
                            ? "0 12px 32px rgba(0, 0, 0, 0.28)"
                            : "0 4px 16px rgba(12, 10, 9, 0.04)",
                    },
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
                styleOverrides: {
                    root: {
                        minHeight: 44,
                        paddingInline: 18,
                        borderRadius: 999,
                    },
                    contained: {
                        boxShadow: "none",
                    },
                    outlined: {
                        borderColor: alpha(theme.palette.text.primary, isDark ? 0.22 : 0.16),
                        backgroundColor: "transparent",
                    },
                    text: {
                        color: theme.palette.text.primary,
                    },
                    sizeSmall: {
                        minHeight: 36,
                        paddingInline: 14,
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 999,
                        fontWeight: 700,
                    },
                    outlined: {
                        borderColor: alpha(theme.palette.text.primary, isDark ? 0.18 : 0.12),
                        backgroundColor: isDark ? alpha(canvas, 0.06) : surfaceStrong,
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: 3,
                        backgroundColor: isDark
                            ? alpha(canvas, 0.04)
                            : alpha("#FFFFFF", 0.9),
                        transition: theme.transitions.create(["border-color", "box-shadow", "background-color"]),
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: alpha(theme.palette.primary.main, 0.34),
                        },
                        "&.Mui-focused": {
                            boxShadow: `0 0 0 4px ${alpha(theme.palette.primary.main, 0.14)}`,
                        },
                    },
                    notchedOutline: {
                        borderColor: alpha(theme.palette.text.primary, isDark ? 0.14 : 0.12),
                    },
                    input: {
                        paddingBlock: 14,
                    },
                },
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        fontWeight: 600,
                    },
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        borderRadius: 16,
                    },
                    standardInfo: {
                        backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.08),
                    },
                },
            },
            MuiAvatar: {
                styleOverrides: {
                    root: {
                        fontWeight: 800,
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        borderRight: "none",
                        backgroundColor: alpha(theme.palette.background.default, isDark ? 0.96 : 0.98),
                    },
                },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 16,
                        minHeight: 48,
                        "&.Mui-selected": {
                            backgroundColor: isDark ? alpha(canvas, 0.08) : surfaceStrong,
                            color: theme.palette.primary.main,
                            "& .MuiListItemIcon-root": {
                                color: theme.palette.primary.main,
                            },
                        },
                        "&:hover": {
                            backgroundColor: isDark ? alpha(canvas, 0.06) : alpha(warmInk, 0.05),
                        },
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    head: {
                        fontWeight: 800,
                        color: theme.palette.text.secondary,
                        backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.1 : 0.04),
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        borderRadius: 3,
                        backgroundColor: alpha(theme.palette.text.primary, 0.9),
                        color: theme.palette.background.paper,
                        fontSize: "0.78rem",
                    },
                },
            },
            MuiSkeleton: {
                defaultProps: {
                    animation: "wave",
                },
            },
        },
    });
}

export const lightTheme = buildTheme("light");
export const darkTheme = buildTheme("dark");

export type ColorMode = "light" | "dark" | "system";
