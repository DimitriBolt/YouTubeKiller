const TIME_LIMIT_MINUTES = 2; // Основной таймер
const WARNING_BEFORE_SECONDS = 60; // За сколько секунд предупреждать
const BLOCK_DURATION_MS = 60 * 1000; // Блокировка повторного открытия YouTube после автозакрытия (1 минута)

// URL, который нужно открыть вместо YouTube
const TARGET_URL = "https://chatgpt.com/g/g-p-68be258b13c881919b1121c15fdd2789-theory/project";

// Временная метка (ms), до которой доступ к YouTube заблокирован
let blockedUntil = 0;

// Набор табов, для которых уже созданы будильники (чтобы не регистрировать дважды)
const trackedTabs = new Set();

function isYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('youtube.com') || url.includes('youtu.be');
}

function isBlocked() {
    return Date.now() < blockedUntil;
}

// Обрабатываем обновление вкладок
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab && tab.url) {
        // Если на данный момент включена блокировка — сразу закрываем эту вкладку и открываем TARGET_URL в новом окне
        if (isYouTubeUrl(tab.url) && isBlocked()) {
            console.log(`Blocked YouTube open (tab ${tabId}). Closing and opening target.`);

            // Откроем целевой URL в новом окне
            chrome.windows.create({ url: TARGET_URL, focused: true }, (newWindow) => {
                if (chrome.runtime.lastError) {
                    console.warn('Failed to create new window during blocked handling:', chrome.runtime.lastError.message);
                } else {
                    console.log('Opened new window id=', newWindow && newWindow.id);
                }
                // Попробуем закрыть вкладку-нарушителя
                chrome.tabs.remove(tabId, () => {
                    if (chrome.runtime.lastError) {
                        console.warn(`Failed to remove blocked tab ${tabId}:`, chrome.runtime.lastError.message);
                    } else {
                        console.log(`Blocked YouTube tab ${tabId} removed`);
                    }

                    // Очистим любые будильники, если они были
                    chrome.alarms.clear(`close_tab_${tabId}`);
                    chrome.alarms.clear(`warn_tab_${tabId}`);
                    trackedTabs.delete(tabId);
                });
            });

            return; // не продолжаем обычную логику
        }

        // Обычная логика — если открылся YouTube, регистрируем будильники для этой вкладки
        if (isYouTubeUrl(tab.url)) {
            // Не создаём будильники дважды для одной вкладки
            if (trackedTabs.has(tabId)) return;

            const mainAlarm = `close_tab_${tabId}`;
            const warnAlarm = `warn_tab_${tabId}`;

            chrome.alarms.get(mainAlarm, (alarm) => {
                if (!alarm) {
                    console.log(`YouTube detected (tab ${tabId}). Timers set.`);

                    // Запоминаем, что для этой вкладки что-то зарегистрировано
                    trackedTabs.add(tabId);

                    // Основной будильник (через TIME_LIMIT_MINUTES)
                    chrome.alarms.create(mainAlarm, { delayInMinutes: TIME_LIMIT_MINUTES });

                    // Будильник для уведомления (основное время минус WARNING_BEFORE_SECONDS)
                    const totalSeconds = TIME_LIMIT_MINUTES * 60;
                    const warnSeconds = Math.max(0, totalSeconds - WARNING_BEFORE_SECONDS);
                    const delayInMinutes = warnSeconds / 60;
                    chrome.alarms.create(warnAlarm, { delayInMinutes: delayInMinutes });
                }
            });
        }
    }
});

// Обработка будильников
chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || !alarm.name) return;

    const parts = alarm.name.split("_");
    if (parts.length < 3) return; // не наш формат

    const tabId = parseInt(parts[2], 10);
    if (isNaN(tabId)) return;

    if (alarm.name.startsWith("warn_tab_")) {
        // Показать уведомление о скором закрытии
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            title: 'Самодисциплина',
            message: `YouTube будет закрыт через ${WARNING_BEFORE_SECONDS} секунд. Пора готовиться к работе!`,
            priority: 2
        }, (notificationId) => {
            if (chrome.runtime.lastError) {
                console.warn('Notification failed:', chrome.runtime.lastError.message);
            } else {
                console.log('Warn notification shown, id=', notificationId);
            }
        });
        return;
    }

    if (alarm.name.startsWith("close_tab_")) {
        console.log(`Close alarm fired for tab ${tabId}`);

        // Устанавливаем блокировку на указанное время
        blockedUntil = Date.now() + BLOCK_DURATION_MS;
        console.log(`YouTube blocked until ${new Date(blockedUntil).toISOString()}`);

        // Открываем целевой URL в новом окне
        chrome.windows.create({ url: TARGET_URL, focused: true }, (newWindow) => {
            if (chrome.runtime.lastError) {
                console.warn('Failed to create new window:', chrome.runtime.lastError.message);
            } else {
                console.log('Opened new window id=', newWindow && newWindow.id);
            }

            // Закрываем исходную вкладку (если она ещё существует)
            chrome.tabs.remove(tabId, () => {
                if (chrome.runtime.lastError) {
                    console.warn(`Failed to remove tab ${tabId}:`, chrome.runtime.lastError.message);
                } else {
                    console.log(`YouTube tab ${tabId} closed`);
                }

                // Очистим связанные будильники и трекинг
                chrome.alarms.clear(`close_tab_${tabId}`);
                chrome.alarms.clear(`warn_tab_${tabId}`);
                trackedTabs.delete(tabId);
            });
        });
    }
});

// Если вкладка закрывается вручную — убираем связанные будильники
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.alarms.clear(`close_tab_${tabId}`);
    chrome.alarms.clear(`warn_tab_${tabId}`);
    trackedTabs.delete(tabId);
});

// Дополнительно: при старте расширения можно очистить состояние (безопасность)
chrome.runtime.onStartup.addListener(() => {
    console.log('Extension startup: clearing tracked tabs and alarms might be considered.');
});

// И при установке
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed or updated.');
});