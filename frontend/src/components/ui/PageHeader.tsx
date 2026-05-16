import { Box, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

type PageHeaderProps = {
    eyebrow?: string;
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    meta?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions, meta }: PageHeaderProps) {
    return (
        <Box
            sx={(theme) => ({
                position: "relative",
                overflow: "hidden",
                borderRadius: { xs: 4, md: 5 },
                border: `1px solid ${theme.palette.divider}`,
                px: { xs: 2.5, md: 4 },
                py: { xs: 3, md: 4 },
                backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.88 : 0.96),
                boxShadow:
                    theme.palette.mode === "dark"
                        ? "0 16px 44px rgba(0, 0, 0, 0.28)"
                        : "0 4px 16px rgba(12, 10, 9, 0.04)",
            })}
        >
            <Stack
                direction={{ xs: "column", lg: actions ? "row" : "column" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", lg: "flex-end" }}
                spacing={3}
                sx={{ position: "relative", zIndex: 1 }}
            >
                <Box sx={{ maxWidth: 760 }}>
                    {eyebrow && (
                        <Chip
                            label={eyebrow}
                            size="small"
                            variant="outlined"
                            sx={{ mb: 1.5 }}
                        />
                    )}
                    <Typography variant="h3">{title}</Typography>
                    {description && (
                        <Typography
                            color="text.secondary"
                            sx={{ mt: 1.25, maxWidth: 720, fontSize: { xs: "0.95rem", md: "1.02rem" } }}
                        >
                            {description}
                        </Typography>
                    )}
                    {meta && (
                        <Stack direction="row" flexWrap="wrap" gap={1.25} sx={{ mt: 2.5 }}>
                            {meta}
                        </Stack>
                    )}
                </Box>
                {actions && (
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ width: { xs: "100%", lg: "auto" } }}>
                        {actions}
                    </Stack>
                )}
            </Stack>
        </Box>
    );
}
