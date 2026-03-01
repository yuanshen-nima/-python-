export class ApiService {
    /**
     * 获取地图数据 (支持年份参数)
     * @param {number} year 年份
     */
    static async getMapData(year = 2025) {
        // 请求例如: /api/map?year=2010
        const res = await fetch(`/api/map?year=${year}`);
        return await res.json();
    }

    static async getStatsData() {
        const res = await fetch('/api/stats');
        return await res.json();
    }

    static async getIndicesData() {
        const res = await fetch('/api/indices');
        return await res.json();
    }

    static async getPrediction() {
        const res = await fetch('/api/predict');
        return await res.json();
    }
}