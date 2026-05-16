import {
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    SettingsBrightness as SystemModeIcon,
} from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/material";
import { useColorMode } from "../../app/colorModeContext";

export function AppThemeToggle() {
    const { colorMode, setColorMode } = useColorMode();

    function cycle() {
        const next: Record<string, typeof colorMode> = { light: "dark", dark: "system", system: "light" };
        setColorMode(next[colorMode]);
    }

    const icon =
        colorMode === "light" ? <LightModeIcon fontSize="small" /> :
        colorMode === "dark" ? <DarkModeIcon fontSize="small" /> :
        <SystemModeIcon fontSize="small" />;

    return (
        <Tooltip title={`Theme: ${colorMode}`}>
            <IconButton onClick={cycle} size="small" sx={{ border: 1, borderColor: "divider", bgcolor: "background.paper" }}>
                {icon}
            </IconButton>
        </Tooltip>
    );
}
