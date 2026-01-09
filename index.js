// 格式化时间，去掉秒，让界面更清爽
function formatDateTime(dateString) {
    if (!dateString) return "未知";
    const date = new Date(dateString);
    // 检查是否是今天
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeStr = date.toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });

    if (isToday) {
        return `今天 ${timeStr}`;
    }

    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getMinutesDiff(dateString) {
    if (!dateString) return Infinity;
    const now = new Date();
    const date = new Date(dateString);
    return Math.floor((now - date) / (1000 * 60));
}

function isHeartbeatTimeout(lastUpdatedAt) {
    return getMinutesDiff(lastUpdatedAt) > 8;
}

// 获取状态配置（文本、颜色类名）
function getStatusConfig(status, lastUpdatedAt) {
    const isTimeout = status !== 0 && isHeartbeatTimeout(lastUpdatedAt);

    // 0:离线, 1:在线, 2:息屏, 3:锁定
    if (isTimeout || status === 0) {
        return { text: "离线", class: "bg-red" };
    }
    
    switch (status) {
        case 1: return { text: "活跃", class: "bg-green" };
        case 2: return { text: "息屏", class: "bg-orange" }; // 屏幕关闭
        case 3: return { text: "锁定", class: "bg-blue" };
        default: return { text: "未知", class: "bg-red" };
    }
}

// 电池信息处理
function getBatteryInfo(battery) {
    if (!battery || battery.power === undefined) {
        return null;
    }

    const { power, charging } = battery;
    let colorClass = '';
    
    if (charging) {
        colorClass = 'text-green'; // CSS中可以添加这个辅助类，或者利用行内样式
    } else if (power <= 20) {
        colorClass = 'text-red';
    }

    return {
        power,
        charging,
        color: power <= 20 && !charging ? '#ef4444' : (charging ? '#10b981' : 'inherit')
    };
}

function getOverallStatus(data) {
    const devices = data.filter(d => !d?.ignored);
    const hasActiveDevice = devices.some(device =>
        device.status === 1 && !isHeartbeatTimeout(device.lastUpdatedAt)
    );

    if (hasActiveDevice) {
        return {
            status: "online",
            icon: "🐱",
            title: "目前在线",
            desc: "狼现在很活跃，快去抓他！（大雾"
        };
    }

    const lastOnlineTimes = devices
        .map(device => device.lastOnline ? new Date(device.lastOnline).getTime() : 0)
        .filter(time => time > 0);

    if (lastOnlineTimes.length === 0) {
        return {
            status: "offline",
            icon: "💤",
            title: "完全离线",
            desc: "大概是睡着了，或者是去火星了。"
        };
    }

    const latestLastOnline = Math.max(...lastOnlineTimes);
    const minutesSinceLastOnline = getMinutesDiff(new Date(latestLastOnline));

    if (minutesSinceLastOnline <= 60) {
        return {
            status: "maybe",
            icon: "🤔",
            title: "可能在忙",
            desc: "最近一小时内出现过，可能还没走远。"
        };
    } else {
        return {
            status: "offline",
            icon: "💤",
            title: "离线中",
            desc: "看起来已经离开好一阵子了。"
        };
    }
}

async function fetchData() {
    try {
        const response = await fetch('https://dc1.zerowolf.top:1641/api/v1/status');
        if (!response.ok) throw new Error('Status Network Error');
        return await response.json();
    } catch (error) {
        console.error('Fetch failed:', error);
        throw error;
    }
}

function renderPage(data) {
    const devices = data.data;
    const overall = getOverallStatus(devices);
    const statusDiv = document.getElementById('status-message');
    const listDiv = document.getElementById('devices-container');

    // 1. 渲染主状态横幅
    statusDiv.innerHTML = `
        <div class="status-banner ${overall.status}">
            <div class="big-icon">${overall.icon}</div>
            <div>
                <div class="status-title">${overall.title}</div>
                <div class="status-desc">${overall.desc}</div>
            </div>
        </div>
    `;

    // 2. 渲染设备列表
    listDiv.innerHTML = '';
    
    // 排序：在线的在前，离线的在后
    devices.sort((a, b) => {
        const aActive = (a.status !== 0 && !isHeartbeatTimeout(a.lastUpdatedAt));
        const bActive = (b.status !== 0 && !isHeartbeatTimeout(b.lastUpdatedAt));
        return bActive - aActive;
    });

    devices.forEach(device => {
        const statusConfig = getStatusConfig(device.status, device.lastUpdatedAt);
        const battery = getBatteryInfo(device.battery);
        const ignoredTag = device.ignored ? '<span style="font-size:0.8em; opacity:0.6; margin-left:5px">(已隐藏)</span>' : '';

        // 构建电池 HTML
        let batteryHtml = '';
        if (battery) {
            const icon = battery.charging ? '⚡' : (battery.power > 30 ? '🔋' : '🪫');
            batteryHtml = `
                <div class="info-row">
                    <span class="info-label">电量</span>
                    <div class="battery-wrapper" style="color: ${battery.color}">
                        ${icon} <span class="battery-text">${battery.power}%</span>
                    </div>
                </div>
            `;
        }

        const cardHtml = `
            <div class="device-card">
                <div class="device-header">
                    <div>
                        <div class="device-name">${device.name}${ignoredTag}</div>
                    </div>
                    <div class="device-badge ${statusConfig.class}">
                        ${statusConfig.text}
                    </div>
                </div>
                
                <div class="device-body">
                    <div class="info-row">
                        <span class="info-label">当前应用</span>
                        <span class="info-val" title="${device.message}">${device.message || '无'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">最后更新</span>
                        <span class="info-val">${formatDateTime(device.lastUpdatedAt)}</span>
                    </div>
                    ${batteryHtml}
                </div>
            </div>
        `;
        listDiv.insertAdjacentHTML('beforeend', cardHtml);
    });
}

function showErrorStatus(error) {
    document.getElementById('status-message').innerHTML = `
        <div class="status-banner offline">
            <div class="big-icon">❌</div>
            <div>
                <div class="status-title">连接失败</div>
                <div class="status-desc">无法获取状态数据，请稍后再试喵。</div>
            </div>
        </div>
    `;
    document.getElementById('devices-container').innerHTML = '';
}

function updateCountdown(seconds) {
    document.getElementById('countdown').textContent = seconds;
}

document.addEventListener('DOMContentLoaded', function () {
    let countdown = 10;
    let interval;

    function startTimer() {
        countdown = 10;
        updateCountdown(countdown);
        if (interval) clearInterval(interval);
        
        interval = setInterval(() => {
            countdown--;
            updateCountdown(countdown);
            if (countdown <= 0) {
                clearInterval(interval);
                loadData();
            }
        }, 1000);
    }

    async function loadData() {
        try {
            const data = await fetchData();
            renderPage(data);
        } catch (e) {
            showErrorStatus(e);
        } finally {
            startTimer();
        }
    }

    // 初始加载
    loadData();

    // 按钮事件
    const btn = document.getElementById('refresh-btn');
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;margin:0 5px 0 0;vertical-align:middle"></span> 刷新中...';
        
        if (interval) clearInterval(interval);
        
        try {
            const data = await fetchData();
            renderPage(data);
        } catch (e) {
            showErrorStatus(e);
        }
        
        // 稍微延迟一下恢复按钮，防止闪烁太快
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = '<span class="icon">↻</span> 立即刷新';
            startTimer();
        }, 800);
    });
});