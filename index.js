// 将时间格式化
        function formatDateTime(dateString) {
            if (!dateString) return "未知";
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }

        // 计算时间差（分钟）
        function getMinutesDiff(dateString) {
            if (!dateString) return Infinity;
            const now = new Date();
            const date = new Date(dateString);
            return Math.floor((now - date) / (1000 * 60));
        }

        // 心跳超时判断
        function isHeartbeatTimeout(lastUpdatedAt) {
            return getMinutesDiff(lastUpdatedAt) > 8;
        }

        // 获取设备状态文本
        function getStatusText(status, lastUpdatedAt) {
            const statusMap = {
                0: "离线",
                1: "在线",
                2: "屏幕关闭",
                3: "已锁定"
            };

            // 如果超时，强制返回“离线”
            if (status !== 0 && isHeartbeatTimeout(lastUpdatedAt)) {
                return statusMap[0];
            }

            return statusMap[status] || "未知";
        }

        // 获取设备状态CSS类名
        function getStatusClass(status, lastUpdatedAt) {
            // 如果超时，强制返回“offline”样式
            if (status !== 0 && isHeartbeatTimeout(lastUpdatedAt)) {
                return "offline";
            }

            const classMap = {
                0: "offline",
                1: "online",
                2: "screen-off",
                3: "locked"
            };

            return classMap[status] || "offline";
        }

        // 电池信息
        function getBatteryInfo(battery) {
            // 设备没有电池
            if (!battery || battery.power === undefined) {
                return { text: '', className: '' };
            }

            const { power, charging } = battery;
            let text = `${power}%`;
            let className = '';

            // 充电
            if (charging) {
                text += ' (充电中)';
                // 充满
                if (power >= 100) {
                    className = 'battery-charged';
                }
                // 没充满
                else {
                    className = 'battery-charging';
                }
            }
            // 没充
            else className = power <= 15 ? 'battery-low' : 'battery-normal';

            return { text, className };
        }

        // 检验所有设备状态
        function getOverallStatus(data) {
            // 忽略某些设备
            const devices = data.filter(d => !d?.ignored);

            // 检查任意设备是否在线且未超时
            const hasActiveDevice = devices.some(device =>
                device.status === 1 && !isHeartbeatTimeout(device.lastUpdatedAt)
            );

            if (hasActiveDevice) {
                return {
                    status: "online",
                    message: "在线",
                    detail: "可以直接联系"
                };
            }

            // 获取所有设备的最后在线时间
            const lastOnlineTimes = devices
                .map(device => device.lastOnline ? new Date(device.lastOnline).getTime() : 0)
                .filter(time => time > 0);

            if (lastOnlineTimes.length === 0) {
                return {
                    status: "offline",
                    message: "似了",
                    detail: "看起来并不在线"
                };
            }

            // 获取最近一次在线时间
            const latestLastOnline = Math.max(...lastOnlineTimes);
            const minutesSinceLastOnline = getMinutesDiff(new Date(latestLastOnline));

            if (minutesSinceLastOnline <= 60) {
                return {
                    status: "maybe",
                    message: "可能似了？",
                    detail: "不确定，但最近有活动过"
                };
            } else {
                return {
                    status: "offline",
                    message: "似了",
                    detail: "看起来并不在线"
                };
            }
        }

        // 从API获取数据
        async function fetchData() {
            try {
                const response = await fetch('https://dc1.zerowolf.top:1641/api/v1/status');
                if (!response.ok) {
                    throw new Error('网络响应不正常');
                }
                return await response.json();
            } catch (error) {
                console.error('获取数据失败:', error);
                throw error;
            }
        }

        // 展示错误状态
        function showErrorStatus(error) {
            const statusMessage = document.getElementById('status-message');
            statusMessage.innerHTML = `
                <div class="error-status">
                    <div class="status-icon">❌</div>
                    <div>
                        <div class="status-text">数据获取失败</div>
                        <div class="status-detail">${error.message || '无法连接到服务器'}</div>
                    </div>
                </div>
            `;

            document.getElementById('devices-container').innerHTML = '';
        }

        // 渲染页面
        function renderPage(data) {
            const devices = data.data;
            const overallStatus = getOverallStatus(devices);

            // 更新状态消息
            const statusMessage = document.getElementById('status-message');
            let statusClass = "";
            let statusIcon = "";

            if (overallStatus.status === "online") {
                statusClass = "online-status";
                statusIcon = "✅";
            } else if (overallStatus.status === "maybe") {
                statusClass = "maybe-status";
                statusIcon = "🤔";
            } else {
                statusClass = "offline-status";
                statusIcon = "❌";
            }

            statusMessage.innerHTML = `
                <div class="${statusClass}">
                    <div class="status-icon">${statusIcon}</div>
                    <div>
                        <div class="status-text">${overallStatus.message}</div>
                        <div class="status-detail">${overallStatus.detail}</div>
                    </div>
                </div>
            `;

            // 渲染设备卡片
            const devicesContainer = document.getElementById('devices-container');
            devicesContainer.innerHTML = '';

            devices.forEach(device => {
                const deviceCard = document.createElement('div');
                deviceCard.className = 'device-card';

                const statusText = getStatusText(device.status, device.lastUpdatedAt);
                const statusClass = getStatusClass(device.status, device.lastUpdatedAt);
                // 新增：获取当前设备的电池信息
                const { text: batteryText, className: batteryClassName } = getBatteryInfo(device.battery);

                // 检查设备是否被忽略
                const ignoredLabel = device.ignored ? '<span class="ignored-label">(已忽略)</span>' : '';

                deviceCard.innerHTML = `
                    <div class="device-header">
                        <div class="device-name-container">
                            <div class="device-name">${device.name}</div>
                            ${ignoredLabel}
                        </div>
                        <div class="device-status ${statusClass}">
                            ${statusText}
                        </div>
                    </div>
                    <div class="device-info">
                        <div class="info-item">
                            <div class="info-label">上次更新:</div>
                            <div class="info-value">${formatDateTime(device.lastUpdatedAt)}</div>
                            </div>
                        <div class="info-item">
                            <div class="info-label">上次在线:</div>
                            <div class="info-value">${formatDateTime(device.lastOnline)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">打开的APP:</div>
                            <div class="info-value">${device.message}</div>
                        </div>
                        ${batteryText ? `<div class="info-item">
                            <div class="info-label">电池:</div>
                            <div class="info-value ${batteryClassName}"><strong>${batteryText}</strong></div>
                        </div>` : ''}
                    </div>
                `;

                devicesContainer.appendChild(deviceCard);
            });
        }

        // 更新倒计时显示
        function updateCountdown(seconds) {
            document.getElementById('countdown').textContent = seconds;
        }

        // 加载页面
        document.addEventListener('DOMContentLoaded', async function () {
            let countdown = 10;
            let countdownInterval;

            // 开始倒计时
            function startCountdown() {
                countdown = 10;
                updateCountdown(countdown);

                if (countdownInterval) {
                    clearInterval(countdownInterval);
                }

                countdownInterval = setInterval(() => {
                    countdown--;
                    updateCountdown(countdown);

                    if (countdown <= 0) {
                        clearInterval(countdownInterval);
                        fetchAndUpdateData();
                    }
                }, 1000);
            }

            // 获取与更新数据
            async function fetchAndUpdateData() {
                try {
                    const data = await fetchData();
                    renderPage(data);
                } catch (error) {
                    showErrorStatus(error);
                } finally {
                    // 10 秒后重新获取
                    startCountdown();
                }
            }

            // 加载
            fetchAndUpdateData();

            // 刷新按钮
            document.getElementById('refresh-btn').addEventListener('click', async function () {
                this.disabled = true;
                this.textContent = '刷新中...';

                // 清空倒计时
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                }

                await fetchAndUpdateData();

                setTimeout(() => {
                    this.disabled = false;
                    this.textContent = '立即刷新';
                }, 1000);
            });
        });