import { CLASS_CONFIG } from './config.js';
import { ApiService } from './api.js';

export class MapManager {
    constructor(mapId, legendId) {
        this.mapId = mapId;
        this.legendId = legendId;
        this.map = null;
        
        this.layerGroups = {}; 
        this.layerControl = null;
        
        // ★★★ 修改这里：加上 2022，并按顺序排列 ★★★
        this.availableYears = [2000, 2010, 2020, 2022, 2025];
        this.currentYear = 2025; // 默认显示的年份
    }

    init() {
        // 1. 初始化地图
        this.map = L.map(this.mapId, {
            zoomControl: false, 
            attributionControl: false
        }).setView([38.9, 100.4], 9);
        
        L.control.zoom({position: 'topleft'}).addTo(this.map);

        // 2. 底图
        const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 17});
        const street = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {maxZoom: 18});
        street.addTo(this.map);

        // 3. 初始化图层组
        for (let key in CLASS_CONFIG) {
            const name = CLASS_CONFIG[key].name;
            this.layerGroups[name] = L.layerGroup().addTo(this.map);
        }

        // 4. ★★★ 先添加：图层控制器 (Layer Control) ★★★
        // 这样它就会占据右上角的“第一把交椅”
        const baseMaps = { "街道地图": street, "卫星影像": satellite };
        const overlayMaps = {};
        for (let key in CLASS_CONFIG) {
            const cfg = CLASS_CONFIG[key];
            const label = `<span style="color:${cfg.color}; font-size:14px;">■</span> ${cfg.name}`;
            overlayMaps[label] = this.layerGroups[cfg.name];
        }
        this.layerControl = L.control.layers(baseMaps, overlayMaps, { 
            collapsed: false, // 展开状态，正如你截图所示
            position: 'topright' 
        }).addTo(this.map);

        // 5. ★★★ 后添加：年份选择控件 (Year Control) ★★★
        // 因为它是后来的，Leaflet 会把它放在图层控制器的“下面”
        this._addYearControl();

        // 6. 加载数据...
        this._renderLegend();
        this._loadData(this.currentYear);
    }

    /**
     * 创建自定义的年份选择控件
     */
    _addYearControl() {
        const YearControl = L.Control.extend({
            options: { position: 'topright' }, // 放在右上角，图层控制器的下方

            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'year-control leaflet-bar');
                
                // 标签
                const label = L.DomUtil.create('span', '', container);
                label.innerHTML = '📅 数据年份: ';
                
                // 下拉框
                const select = L.DomUtil.create('select', 'year-select', container);
                
                // 生成选项
                this.availableYears.forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.text = year + '年';
                    if (year === this.currentYear) option.selected = true;
                    select.appendChild(option);
                });

                // 防止点击穿透到地图
                L.DomEvent.disableClickPropagation(container);

                // 绑定变更事件
                select.addEventListener('change', (e) => {
                    const newYear = parseInt(e.target.value);
                    this._loadData(newYear);
                });

                return container;
            }
        });

        this.map.addControl(new YearControl());
    }

    _renderLegend() {
        let html = '<h4>地物分类图例</h4>';
        for(let key in CLASS_CONFIG) {
            html += `
            <div class="legend-item">
                <div class="color-box" style="background:${CLASS_CONFIG[key].color}"></div>
                ${CLASS_CONFIG[key].name}
            </div>`;
        }
        const legendBox = document.getElementById(this.legendId);
        if(legendBox) legendBox.innerHTML = html;
    }

    async _loadData(year) {
        console.log(`>>> 正在加载 ${year} 年地图数据...`);
        this.currentYear = year;

        // ★ 核心步骤：加载新数据前，先清空所有旧图层
        for (let name in this.layerGroups) {
            this.layerGroups[name].clearLayers();
        }

        try {
            // 调用带参数的 API
            const data = await ApiService.getMapData(year);
            
            if(data.error || !data.features) {
                console.warn(`年份 ${year} 无数据`);
                return;
            }

            // 分发数据到图层组
            L.geoJSON(data, {
                style: (feature) => {
                    const type = feature.properties.label;
                    const cfg = CLASS_CONFIG[type];
                    return {
                        color: cfg ? cfg.color : '#ccc',
                        weight: 0,
                        fillOpacity: 0.85
                    };
                },
                onEachFeature: (feature, layer) => {
                    const type = feature.properties.label;
                    const cfg = CLASS_CONFIG[type];
                    if (cfg) {
                        const group = this.layerGroups[cfg.name];
                        if (group) group.addLayer(layer);
                    }
                }
            });
            console.log(`✅ ${year} 年数据加载完成`);

        } catch (err) {
            console.error("地图数据加载失败:", err);
        }
    }

    resize() {
        if(this.map) this.map.invalidateSize();
    }
}