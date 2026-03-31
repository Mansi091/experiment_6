from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import pickle
from datetime import datetime
import os

app = FastAPI(title="RoadSense AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model, scaler, feature_columns = None, None, None

try:
    if os.path.exists('best_accident_model.pkl'):
        with open('best_accident_model.pkl', 'rb') as f:
            model = pickle.load(f)
        with open('scaler.pkl', 'rb') as f:
            scaler = pickle.load(f)
        with open('feature_columns.pkl', 'rb') as f:
            feature_columns = pickle.load(f)
except Exception as e:
    print(f"Failed to load model: {e}")

class PredictRequest(BaseModel):
    hour: int
    speed_limit: int
    road_type: int
    weather_conditions: int
    light_conditions: int
    road_surface: int
    urban_rural: int
    num_vehicles: int
    num_casualties: int
    age_of_driver: float
    age_of_vehicle: float
    day_of_week: int

@app.post("/predict")
def predict_risk(req: PredictRequest):
    hour = req.hour
    day_of_week = req.day_of_week
    month = datetime.now().month
    
    is_rush = int((hour in range(7,10) or hour in range(16,20)) and day_of_week in range(2,7))
    is_wkend = int(day_of_week in [1, 7])
    is_night = int(hour >= 22 or hour <= 5)
    
    if month in [12, 1, 2]: season = 1
    elif month in [3, 4, 5]: season = 2
    elif month in [6, 7, 8]: season = 3
    else: season = 4
    
    speed_n = (min(max(req.speed_limit, 20), 70) - 20) / 50
    rr_score = (speed_n + req.road_surface / 5 + req.weather_conditions / 9)
    rr_score = min(rr_score / 3, 1.0)
    high_cas = int(req.num_casualties >= 3)

    if not feature_columns:
        risk_score = rr_score
        pred_class = 2 if risk_score < 0.4 else (1 if risk_score < 0.7 else 0)
        probs = [0.1, 0.2, 0.7]
        return {"prediction": pred_class, "probabilities": probs, "risk_score": risk_score}
        
    row = {col: 0 for col in feature_columns}
    row.update({
        'Hour': req.hour, 'Speed_limit': req.speed_limit, 'Road_Type': req.road_type, 
        'Weather_Conditions': req.weather_conditions, 'Light_Conditions': req.light_conditions, 
        'Road_Surface_Conditions': req.road_surface, 'Urban_or_Rural_Area': req.urban_rural, 
        'num_vehicles': req.num_vehicles, 'num_casualties': req.num_casualties, 
        'Age_of_Driver': req.age_of_driver, 'Age_of_Vehicle': req.age_of_vehicle, 
        'Day_of_Week': req.day_of_week, 'Junction_Detail': 0, 'Month': month,
        'Is_Rush_Hour': is_rush, 'Is_Weekend': is_wkend, 'Is_Night': is_night,
        'Season': season, 'Road_Risk_Score': rr_score, 'High_Casualty': high_cas
    })

    X_in = pd.DataFrame([row])[feature_columns]
    try:
        if hasattr(model, 'predict_proba'):
            probs = model.predict_proba(X_in)[0].tolist()
            pred_class = int(np.argmax(probs))
        else:
            pred_class = int(model.predict(X_in)[0])
            probs = [0, 0, 1]
    except Exception as e: 
        try:
            X_sc = scaler.transform(X_in)
            probs = model.predict_proba(X_sc)[0].tolist()
            pred_class = int(np.argmax(probs))
        except:
             pred_class, probs = 2, [0.0, 0.0, 1.0]

    return {"prediction": pred_class, "probabilities": probs, "risk_score": float(rr_score)}
