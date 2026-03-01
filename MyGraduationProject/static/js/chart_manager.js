import { CLASS_CONFIG, CHART_TOOLBOX } from './config.js';
import { ApiService } from './api.js';

export class ChartManager {
    constructor(statsId, indicesId) {
        this.statsDom = document.getElementById(statsId);
        this.indicesDom = document.getElementById(indicesId);
        
        // 主图表实例
        this.statsChart = echarts.init(this.statsDom);
        this.indicesChart = echarts.init(this.indicesDom);
        
        // ★★★ 新增：存储所有小饼图的实例，方便窗口缩放时 resize ★★★
        this.miniPieCharts = [];

        this.activeChart = null; 
        this.activeType = null;

        this._initAutoResize();
    }

    _initAutoResize() {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                window.requestAnimationFrame(() => {
                    if (entry.target === this.statsDom) this.statsChart.resize();
                    if (entry.target === this.indicesDom) this.indicesChart.resize();
                });
            }
            // ★★★ 顺便让小饼图也自适应 ★★★
            this.miniPieCharts.forEach(chart => chart.resize());
        });
        resizeObserver.observe(this.statsDom);
        resizeObserver.observe(this.indicesDom);
        
        // 监听侧边栏容器的大小变化（如果 sidebar 面板本身在缩放）
        const sidebarPanel = document.getElementById('sidebarPanel');
        if(sidebarPanel) resizeObserver.observe(sidebarPanel);
    }

    init() {
        this._loadStats();
        this._loadIndices();
    }

    setActive(type) {
        this.activeType = type;
        if (type === 'stats') {
            this.activeChart = this.statsChart;
        } else if (type === 'indices') {
            this.activeChart = this.indicesChart;
        } else {
            this.activeChart = null;
        }
    }

    // === 工具栏功能 ===
    switchType(type) {
        if (!this.activeChart) return;
        const oldOption = this.activeChart.getOption();
        if (!oldOption || !oldOption.series) return;
        
        const newSeries = oldOption.series.map(s => {
            return {
                type: type, name: s.name, data: s.data, itemStyle: s.itemStyle, stack: s.stack,
                areaStyle: (type === 'line' && s.stack) ? { opacity: 0.3 } : null,
                label: { show: false }
            };
        });
        this.activeChart.setOption({ series: newSeries });
    }

    restore() {
        if (this.activeType === 'stats') this._loadStats();
        else if (this.activeType === 'indices') this._loadIndices();
    }

    saveImage() {
        if (!this.activeChart) return;
        const url = this.activeChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
        const link = document.createElement('a');
        link.href = url;
        link.download = 'chart_export.png';
        link.click();
    }

    // === 数据加载 ===

    async _loadStats() {
        this.statsChart.showLoading();
        // 1. 获取后端 CSV 数据
        const data = await ApiService.getStatsData();
        this.statsChart.hideLoading();
        
        if(!data.years) return;

        // --- 渲染主图 (柱状图/折线图) ---
        const option = {
            tooltip: { trigger: 'axis', axisPointer: {type: 'shadow'} },
            legend: { top: 0, type: 'scroll' },
            grid: { left: '3%', right: '5%', bottom: '3%', top: '40px', containLabel: true },
            xAxis: { type: 'category', data: data.years },
            yAxis: { type: 'value', name: '面积 (ha)' },
            series: data.series.map(s => {
                let color = '#ccc';
                // 颜色匹配逻辑
                for(let k in CLASS_CONFIG) {
                    if(s.name.includes(CLASS_CONFIG[k].name)) color = CLASS_CONFIG[k].color;
                }
                return {
                    name: s.name, type: 'bar', stack: 'total',
                    emphasis: { focus: 'series' },
                    itemStyle: { color: color },
                    data: s.data
                };
            })
        };
        this.statsChart.setOption(option, true);

        // --- ★★★ 2. 渲染下方的小饼图矩阵 ★★★ ---
        this._renderPieGrid(data);
    }

    /**
     * 将 CSV 的时序数据转换为按年份分组的数据，并生成多个饼图
     */
    _renderPieGrid(data) {
        const container = document.getElementById('pieGrid');
        if (!container) return;
        container.innerHTML = ''; // 清空旧图
        this.miniPieCharts = [];  // 清空实例缓存

        const years = data.years;
        const series = data.series;

        // 遍历每一年
        years.forEach((year, yearIndex) => {
            // 1. 准备当前年份的数据
            const pieData = [];
            
            series.forEach(s => {
                const value = s.data[yearIndex]; // 获取该类别在当前年份的面积
                
                // 找到对应的颜色
                let color = '#ccc';
                for(let k in CLASS_CONFIG) {
                    if(s.name.includes(CLASS_CONFIG[k].name)) color = CLASS_CONFIG[k].color;
                }

                if (value > 0) {
                    pieData.push({
                        value: value,
                        name: s.name.split(' ')[0], // 简化名字，去掉英文括号部分，防止饼图太挤
                        itemStyle: { color: color }
                    });
                }
            });

            // 2. 动态创建 DOM 元素
            const card = document.createElement('div');
            card.className = 'pie-card';
            
            const title = document.createElement('div');
            title.className = 'pie-year-title';
            title.innerText = year + '年';
            
            const chartDiv = document.createElement('div');
            chartDiv.className = 'mini-pie';
            
            card.appendChild(title);
            card.appendChild(chartDiv);
            container.appendChild(card);

            // 3. 初始化 ECharts 实例
            const miniChart = echarts.init(chartDiv);
            const option = {
                tooltip: { trigger: 'item', formatter: '{b}: {d}%' }, // 只显示百分比
                series: [
                    {
                        name: year + ' Land Use',
                        type: 'pie',
                        radius: ['40%', '70%'], // 环形图
                        avoidLabelOverlap: false,
                        label: { show: false, position: 'center' }, // 默认不显示标签
                        emphasis: {
                            label: { show: true, fontSize: 12, fontWeight: 'bold' } // 鼠标悬停显示中间文字
                        },
                        labelLine: { show: false },
                        data: pieData
                    }
                ]
            };
            miniChart.setOption(option);
            
            // 存入数组，方便后续 resize
            this.miniPieCharts.push(miniChart);
        });
    }

    async _loadIndices() {
        this.indicesChart.showLoading();
        const data = await ApiService.getIndicesData();
        this.indicesChart.hideLoading();
        if(!data.years) return;

        const option = {
            tooltip: { trigger: 'axis' },
            legend: { data: ['NDVI', 'FVC', 'Wetness'], top: 0 },
            grid: { left: '3%', right: '5%', bottom: '3%', top: '40px', containLabel: true },
            xAxis: { type: 'category', data: data.years, boundaryGap: false },
            yAxis: [
                { type: 'value', name: '指数', min: 0, max: 1, position: 'left' },
                { type: 'value', name: '湿度', position: 'right', splitLine: { show: false } }
            ],
            series: data.series.map(s => {
                const isWetness = s.name === 'Wetness';
                return {
                    name: s.name, type: 'line', smooth: true,
                    yAxisIndex: isWetness ? 1 : 0,
                    itemStyle: { color: isWetness ? '#2980b9' : (s.name==='FVC'?'#27ae60':'#2ecc71') },
                    lineStyle: { width: 3, type: isWetness ? 'dashed' : 'solid' },
                    data: s.data
                };
            })
        };
        this.indicesChart.setOption(option, true);
    }

    async runPrediction(btn) {
        // ... (保持原有的预测代码不变) ...
        btn.innerHTML = "⏳ 计算中...";
        try {
            const pred = await ApiService.getPrediction();
            btn.innerHTML = "✅ 完成";
            btn.style.background = "#27ae60";
            
            const option = this.indicesChart.getOption();
            const years = option.xAxis[0].data;
            if (years[years.length - 1] !== '2030') years.push('2030 (预测)');
            const series = option.series;
            
            series.forEach(s => {
                const p = pred.predictions[s.name.toUpperCase()];
                if(p) {
                    s.data.push(p.value);
                    s.markPoint = { data: [{ value: p.value, xAxis: years.length-1, yAxis: p.value, itemStyle:{color:'red'} }] };
                }
            });
            this.indicesChart.setOption({ xAxis: {data: years}, series: series });
        } catch(e) { btn.innerHTML = "❌ 失败"; }
    }
}