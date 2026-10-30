import { useState, useSyncExternalStore } from "react";
import { formatTimestamp } from "../services/timestamps";
import {
  Badge, Box, IconButton, List, ListItem, ListItemIcon, ListItemText,
  Popover, Stack, Tooltip, Typography,
} from "@mui/material";
import {
  CheckCircleOutlined, Close, DeleteSweepOutlined, DoneAll, ErrorOutlined,
  InfoOutlined, NotificationsNoneOutlined, WarningAmberOutlined,
} from "@mui/icons-material";
import {
  clearOperationNotifications, getOperationNotifications,
  markOperationNotificationsRead, subscribeFeedback,
} from "../services/operationFeedback";

const severityLabels = {
  info: "Informazione", success: "Completata", warning: "Attenzione", error: "Errore",
};
const severityIcons = {
  info: <InfoOutlined />, success: <CheckCircleOutlined />,
  warning: <WarningAmberOutlined />, error: <ErrorOutlined />,
};

export default function NotificationCenter() {
  const notifications = useSyncExternalStore(subscribeFeedback, getOperationNotifications);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const unreadCount = notifications.filter(notification => !notification.read).length;

  function close() {
    markOperationNotificationsRead();
    setAnchor(null);
  }

  return (
    <>
      <Tooltip title="Notifiche">
        <IconButton color="inherit" aria-label={`Notifiche, ${unreadCount} non lette`}
          aria-haspopup="dialog" aria-expanded={Boolean(anchor)}
          aria-controls={anchor ? "operation-notifications" : undefined}
          onClick={event => {
            setAnchor(event.currentTarget);
            markOperationNotificationsRead();
          }}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsNoneOutlined />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        sx={{ zIndex: theme => theme.zIndex.modal + 2 }}
        slotProps={{ paper: {
          id: "operation-notifications", role: "dialog", "aria-labelledby": "operation-notifications-title",
          sx: { width: "min(440px, calc(100vw - 24px))", maxHeight: "min(560px, 75svh)",
            display: "flex", flexDirection: "column", borderRadius: 1 },
        } }}>
        <Stack direction="row" sx={{ alignItems: "center", px: 2, py: 1, gap: 0.5,
          flexShrink: 0, borderBottom: 1, borderColor: "divider" }}>
          <Typography id="operation-notifications-title" variant="subtitle1" sx={{ flex: 1 }}>
            Notifiche ({notifications.length})
          </Typography>
          <Tooltip title="Segna tutte come lette">
            <span><IconButton aria-label="Segna tutte come lette" disabled={!unreadCount}
              onClick={markOperationNotificationsRead}><DoneAll /></IconButton></span>
          </Tooltip>
          <Tooltip title="Svuota notifiche">
            <span><IconButton aria-label="Svuota notifiche" disabled={!notifications.length}
              onClick={clearOperationNotifications}><DeleteSweepOutlined /></IconButton></span>
          </Tooltip>
          <Tooltip title="Chiudi notifiche">
            <IconButton aria-label="Chiudi notifiche" onClick={close}><Close /></IconButton>
          </Tooltip>
        </Stack>
        <Box sx={{ overflowY: "auto", minHeight: 0 }}>
          {!notifications.length && <Typography color="text.secondary" sx={{ p: 3 }}>
            Nessuna notifica
          </Typography>}
          <List disablePadding aria-label="Storico notifiche">
            {notifications.map(notification => (
              <ListItem key={notification.id} alignItems="flex-start" sx={{ px: 2, py: 1,
                borderBottom: 1, borderColor: "divider",
                bgcolor: notification.read ? "transparent" : "action.selected" }}>
                <ListItemIcon sx={{ minWidth: 36, mt: 0.75, color: `${notification.severity}.main` }}>
                  <Tooltip title={severityLabels[notification.severity]}>
                    {severityIcons[notification.severity]}
                  </Tooltip>
                </ListItemIcon>
                <ListItemText primary={notification.message}
                  secondary={`${severityLabels[notification.severity]} | ${formatTimestamp(notification.createdAt)}`}
                  slotProps={{ primary: { variant: "body2", sx: { overflowWrap: "anywhere" } },
                    secondary: { variant: "caption" } }} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>
    </>
  );
}