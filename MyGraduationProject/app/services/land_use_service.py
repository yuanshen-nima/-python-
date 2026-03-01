import json
import os
import re
import ast
import pandas as pd
from flask import current_app
from app.extensions import db
from app.models.ecological_index import LandUseStats
from app.services.base_service import BaseDataService

CLASS_NAMES = {1: '水体', 2: '植被', 3: '耕地', 4: '城镇', 5: '沙地', 6: '裸地'}

class LandUseService(BaseDataService):
    def import_data(self):
        # ... (保持原本的 import_data 代码不变) ...
        if LandUseStats.query.count() > 0: return
        stats_path = current_app.config['STATS_PATH']
        if not self.check_file_exists(stats_path): return
        try:
            df = pd.read_csv(stats_path)
            data_list = []
            for _, row in df.iterrows():
                try:
                    clean_json = re.sub(r'([a-zA-Z0-9_]+)=', r'"\1":', str(row['stats_json']))
                    stats_list = json.loads(clean_json)
                except: continue
                for item in stats_list:
                    cls_id = int(item.get('class', item.get('group', 0)))
                    name = CLASS_NAMES.get(cls_id, f'Class {cls_id}')
                    data_list.append(LandUseStats(year=int(row['year']), class_name=name, area=float(item.get('sum', 0))))
            db.session.add_all(data_list)
            db.session.commit()
            print("✅ 土地利用统计导入成功")
        except Exception as e: print(f"❌ 导入失败: {e}")

    def get_trend_data(self):
        # ... (保持 get_trend_data 代码不变) ...
        all_data = LandUseStats.query.all()
        if not all_data: return {'years': [], 'series': []}
        years = sorted(list(set([d.year for d in all_data])))
        series_map = {name: {y: 0 for y in years} for name in set([d.class_name for d in all_data])}
        for d in all_data: series_map[d.class_name][d.year] = d.area
        return {'years': years, 'series': [{'name': n, 'type': 'line', 'data': [v[y] for y in years]} for n, v in series_map.items()]}
        
    def get_map_json(self, year=2025):
        """
        ★ 修改：根据年份获取对应的 GeoJSON 文件
        2022 -> 读取 map.geojson
        其他 -> 读取 LULC_WebGIS_{year}.geojson
        """
        data_dir = os.path.dirname(current_app.config['MAP_PATH']) # 获取 static/data 目录
        
        # ★★★ 核心修改：特殊处理 2022 年 ★★★
        if year == 2022:
            filename = 'map.geojson' # 你原来的文件
        else:
            filename = f'LULC_WebGIS_{year}.geojson' # GEE 导出的新文件
            
        file_path = os.path.join(data_dir, filename)

        # 容错：如果找不到对应文件，尝试加载 map.geojson 作为兜底
        if not os.path.exists(file_path):
            print(f"⚠️ 警告: 找不到 {filename}，尝试加载默认地图 (map.geojson)")
            file_path = current_app.config['MAP_PATH']
            if not os.path.exists(file_path): return {}

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ 读取地图失败: {e}")
            return {}