import type { ReactNode } from "react";
import {
    Badge,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";

export type NavItem = {
    label: string;
    icon: ReactNode;
    path: string;
    adminOnly?: boolean;
    badge?: number;
    group: "workspace" | "admin";
};

type NavigationBlockProps = {
    title: string;
    items: NavItem[];
    currentPath: string;
    onNavigate: (path: string) => void;
    collapsed: boolean;
};

export function NavigationBlock({
    title,
    items,
    currentPath,
    onNavigate,
    collapsed,
}: NavigationBlockProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <Stack spacing={1}>
            {!collapsed && (
                <Typography variant="overline" color="text.secondary" sx={{ px: 1.5 }}>
                    {title}
                </Typography>
            )}
            <List disablePadding sx={{ display: "grid", gap: 0.75 }}>
                {items.map((item) => {
                    const selected =
                        item.path === "/dashboard"
                            ? currentPath === item.path
                            : currentPath.startsWith(item.path);
                    const itemButton = (
                        <ListItemButton
                            key={item.path}
                            selected={selected}
                            onClick={() => onNavigate(item.path)}
                            sx={
                                collapsed
                                    ? {
                                          minHeight: 48,
                                          px: 1,
                                          justifyContent: "center",
                                      }
                                    : undefined
                            }
                        >
                            <ListItemIcon
                                sx={{
                                    minWidth: collapsed ? "auto" : 40,
                                    justifyContent: "center",
                                }}
                            >
                                {item.badge ? (
                                    <Badge badgeContent={item.badge} color="error">
                                        {item.icon}
                                    </Badge>
                                ) : (
                                    item.icon
                                )}
                            </ListItemIcon>
                            {!collapsed && (
                                <ListItemText
                                    primary={item.label}
                                    secondary={selected ? "Current section" : undefined}
                                    secondaryTypographyProps={{ sx: { fontSize: "0.74rem" } }}
                                />
                            )}
                        </ListItemButton>
                    );

                    if (!collapsed) {
                        return itemButton;
                    }

                    return (
                        <Tooltip key={item.path} title={item.label} placement="right">
                            {itemButton}
                        </Tooltip>
                    );
                })}
            </List>
        </Stack>
    );
}
