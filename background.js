const TIME_LIMIT_MINUTES = 10; // Основной таймер
const WARNING_BEFORE_SECONDS = 20; // За сколько секунд предупреждать

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes("youtube.com") || tab.url.includes("youtu.be")) {
            const mainAlarm = `close_tab_${tabId}`;
            const warnAlarm = `warn_tab_${tabId}`;

            chrome.alarms.get(mainAlarm, (alarm) => {
                if (!alarm) {
                    console.log(`YouTube detected. Timers set.`);

                    // Основной будильник (через X минут)
                    chrome.alarms.create(mainAlarm, { delayInMinutes: TIME_LIMIT_MINUTES });

                    // Будильник для уведомления (основное время минус 10 секунд)
                    const delayInMs = (TIME_LIMIT_MINUTES * 60 * 1000) - (WARNING_BEFORE_SECONDS * 1000);
                    chrome.alarms.create(warnAlarm, { when: Date.now() + delayInMs });
                }
            });
        }
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    const tabId = parseInt(alarm.name.split("_")[2]);

    // ... (весь код выше остается прежним)

    // Логика уведомления
    if (alarm.name.startsWith("warn_tab_")) {
        chrome.notifications.create({
            type: 'basic',
            // Используем пустую строку или не указываем iconUrl вообще
            // В Linux/KDE Chrome подставит свою стандартную иконку
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            title: 'Самодисциплина',
            message: `YouTube будет закрыт через ${WARNING_BEFORE_SECONDS} секунд. Пора готовиться к работе!`,
            priority: 2
        });
    }

    // ... (весь код ниже остается прежним)


    // Логика редиректа (основной будильник)
    if (alarm.name.startsWith("close_tab_")) {
        chrome.tabs.update(tabId, {
            url: "https://chatgpt.com/g/g-p-68be258b13c881919b1121c15fdd2789-theory/project"
        }).then(() => {
            // chrome.tabs.create({ url: "https://d2l.arizona.edu/d2l/home" });
        }).catch(err => console.log("Tab closed before redirect"));
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.alarms.clear(`close_tab_${tabId}`);
    chrome.alarms.clear(`warn_tab_${tabId}`);
});