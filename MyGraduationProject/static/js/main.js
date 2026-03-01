import { MapManager } from './map_manager.js';
import { ChartManager } from './chart_manager.js';
import { SidebarManager } from './sidebar_manager.js';

const mapManager = new MapManager('map', 'legendBox');
const chartManager = new ChartManager('statsChart', 'indicesChart');
const sidebarManager = new SidebarManager();

document.addEventListener('DOMContentLoaded', () => {
    console.log(">>> 系统初始化...");
    
    mapManager.init();
    chartManager.init();
    sidebarManager.init();

    // 1. 面板打开时的常规逻辑 (可能会失效，所以下面加了保险)
    sidebarManager.onPanelOpen = (targetId) => {
        console.log(">>> 面板打开信号:", targetId);
        activateChartLogic(targetId);
    };

    /**
     * 封装激活逻辑：根据当前页面ID，激活对应的ECharts实例
     */
    function activateChartLogic(targetId) {
        const tools = document.getElementById('panelTools');
        
        if (targetId === 'stats') {
            chartManager.setActive('stats');
            if(tools) tools.style.display = 'flex';
            console.log(">>> 已激活: 土地利用统计图");
        } 
        else if (targetId === 'indices') {
            chartManager.setActive('indices');
            if(tools) tools.style.display = 'flex';
            console.log(">>> 已激活: 生态指标图");
        } 
        else {
            // 如果是 info 页面，不需要工具栏
            chartManager.setActive(null);
            if(tools) tools.style.display = 'none';
        }
    }

    // 2. 绑定工具栏按钮点击事件 (加入自愈机制)
    const toolContainer = document.getElementById('panelTools');
    if (toolContainer) {
        toolContainer.addEventListener('click', (e) => {
            // 找到被点击的按钮 (处理图标点击冒泡)
            const btn = e.target.closest('.tool-btn');
            if (!btn) return;

            // ★★★【核心修复】自愈逻辑：如果发现没有激活的图表，现场补救 ★★★
            if (!chartManager.activeChart) {
                console.warn("⚠️ 检测到图表未激活，正在尝试自动修复...");
                
                // 问 SidebarManager：现在到底开着哪个窗口？
                const currentTab = sidebarManager.activeTab;
                
                if (currentTab) {
                    activateChartLogic(currentTab); // 立即手动激活
                    console.log("✅ 自动修复完成，重新激活:", currentTab);
                } else {
                    console.error("❌ 修复失败：无法确定当前窗口");
                    alert("操作失败：请尝试重新打开侧边栏");
                    return;
                }
            }
            // -----------------------------------------------------

            const action = btn.dataset.action;
            console.log(">>> 执行工具操作:", action);

            if (action === 'bar' || action === 'line') {
                chartManager.switchType(action);
            } else if (action === 'restore') {
                chartManager.restore();
            } else if (action === 'save') {
                chartManager.saveImage();
            }
        });
    } else {
        console.error("!!! 严重错误：找不到 panelTools 元素，请检查 HTML");
    }

    // 3. 绑定预测按钮
    const predictBtn = document.getElementById('predictBtn');
    if(predictBtn) {
        predictBtn.addEventListener('click', (e) => {
            // 预测前也检查一下激活状态，防止报错
            if (!chartManager.activeChart) activateChartLogic('indices');
            chartManager.runPrediction(e.currentTarget);
        });
    }
});

window.addEventListener('resize', () => {
    mapManager.resize();
});