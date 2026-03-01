from flask import Blueprint, jsonify, request # ★ 引入 request
from app.services.ecological_service import EcologicalService
from app.services.land_use_service import LandUseService

bp = Blueprint('api', __name__, url_prefix='/api')

eco_service = EcologicalService()
land_service = LandUseService()

@bp.route('/stats', methods=['GET'])
def get_stats():
    try: return jsonify(land_service.get_trend_data())
    except Exception as e: return jsonify({'error': str(e)}), 500

@bp.route('/indices', methods=['GET'])
def get_indices():
    try: return jsonify(eco_service.get_trend_data())
    except Exception as e: return jsonify({'error': str(e)}), 500

@bp.route('/map', methods=['GET'])
def get_map():
    """★ 修改：获取地图数据，支持 ?year=2000 参数"""
    try:
        # 获取前端传来的 year，默认为 2025
        year = request.args.get('year', default=2025, type=int)
        return jsonify(land_service.get_map_json(year))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/predict', methods=['GET'])
def predict_future():
    try: return jsonify(eco_service.predict_future(target_year=2030))
    except Exception as e: return jsonify({'error': str(e)}), 500