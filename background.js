const TIME_LIMIT_MINUTES = 10; // Основной таймер
const WARNING_BEFORE_SECONDS = 60; // За сколько секунд предупреждать

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab && tab.url) {
        if (tab.url.includes("youtube.com") || tab.url.includes("youtu.be")) {
            const mainAlarm = `close_tab_${tabId}`;
            const warnAlarm = `warn_tab_${tabId}`;

            // Если будильник для этого таба уже зарегистрирован, не создаём заново
            chrome.alarms.get(mainAlarm, (alarm) => {
                if (!alarm) {
                    console.log(`YouTube detected (tab ${tabId}). Timers set.`);

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

chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || !alarm.name) return;

    const parts = alarm.name.split("_");
    // Expect names like close_tab_<tabId> or warn_tab_<tabId>
    if (parts.length < 3) return;

    const tabId = parseInt(parts[2], 10);
    if (isNaN(tabId)) return;

    // Логика уведомления
    if (alarm.name.startsWith("warn_tab_")) {
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

    // Логика закрытия: открыть новую ссылку в новом окне и закрыть исходную вкладку
    if (alarm.name.startsWith("close_tab_")) {
        const targetUrl = "https://chatgpt.com/g/g-p-68be258b13c881919b1121c15fdd2789-theory/project";

        // Открываем новое окно с целевым URL
        chrome.windows.create({ url: targetUrl, focused: true }, (newWindow) => {
            if (chrome.runtime.lastError) {
                // Если открыть окно не удалось, всё равно попытаемся убрать вкладку
                console.warn('Failed to create new window:', chrome.runtime.lastError.message);
            } else {
                console.log('Opened new window id=', newWindow && newWindow.id);
            }

            // Закрываем исходную вкладку (если она ещё существует)
            chrome.tabs.remove(tabId, () => {
                if (chrome.runtime.lastError) {
                    // Вполне нормально, если вкладка уже была закрыта пользователем
                    console.warn(`Failed to remove tab ${tabId}:`, chrome.runtime.lastError.message);
                } else {
                    console.log(`YouTube tab ${tabId} closed`);
                }

                // Очистим связанные будильники на всякий случай
                chrome.alarms.clear(`close_tab_${tabId}`);
                chrome.alarms.clear(`warn_tab_${tabId}`);
            });
        });
    }
});

// Если вкладка закрывается вручную — убираем связанные будильники
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.alarms.clear(`close_tab_${tabId}`);
    chrome.alarms.clear(`warn_tab_${tabId}`);
});