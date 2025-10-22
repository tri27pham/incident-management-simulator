import os
import time
import requests
import json
import random
import re
import threading
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

# Configure the Gemini client
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Get the backend URL from an environment variable, with a fallback for local dev
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
INCIDENTS_ENDPOINT = f"{BACKEND_URL}/api/v1/incidents"

app = Flask(__name__)
CORS(app)

# Global state
generator_thread = None
is_running = False
stop_flag = threading.Event()

def clean_json_string(s: str) -> str:
    """Removes markdown code fences and whitespace from a string to extract raw JSON."""
    match = re.search(r'\{.*\}', s, re.DOTALL)
    if match:
        return match.group(0)
    return s.strip()

def generate_incident() -> dict | None:
    """Calls the Gemini API to generate a realistic-sounding software incident."""
    prompt = """
    You are an incident generator for a software company.
    Create a plausible incident description.
    Respond ONLY in valid JSON with two keys:
    1. "message": A string describing the incident (e.g., "API latency has increased by 50% for US-East-1 customers").
    2. "source": A plausible string for the source of the incident (e.g., "api-gateway", "user-database", "checkout-service").
    """
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        
        cleaned_response = clean_json_string(response.text)
        incident_data = json.loads(cleaned_response)

        if "message" in incident_data and "source" in incident_data:
            print(f"🤖 Generated incident: {incident_data['message']} (from: {incident_data['source']})")
            return incident_data
        else:
            print("❌ AI response was malformed. Missing 'message' or 'source'.")
            return None
            
    except Exception as e:
        print(f"❌ Could not generate incident from AI: {e}")
        return None

def report_incident(incident_data: dict):
    """Sends the generated incident to the backend service."""
    try:
        response = requests.post(INCIDENTS_ENDPOINT, json=incident_data)
        response.raise_for_status()  # Raises an exception for 4xx/5xx errors
        print(f"✅ Successfully reported incident. Backend responded with ID: {response.json().get('id')}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to report incident to backend: {e}")

def generation_loop():
    """Background thread loop to generate and report incidents periodically."""
    global is_running
    print("🚀 Incident Generator loop started.")
    print(f"➡️ Reporting incidents to: {INCIDENTS_ENDPOINT}")
    
    while not stop_flag.is_set():
        incident = generate_incident()
        if incident:
            report_incident(incident)
        
        # Wait for a random interval before generating the next incident
        # Check stop_flag more frequently to be responsive
        sleep_duration = random.randint(30, 90)
        print(f"🕒 Waiting for {sleep_duration} seconds...")
        
        for _ in range(sleep_duration):
            if stop_flag.is_set():
                break
            time.sleep(1)
    
    is_running = False
    print("🛑 Incident Generator loop stopped.")

@app.route('/api/start', methods=['POST'])
def start_generator():
    """Start the incident generator in a background thread."""
    global generator_thread, is_running, stop_flag
    
    if is_running:
        return jsonify({"status": "already_running", "message": "Generator is already running"}), 200
    
    stop_flag.clear()
    is_running = True
    generator_thread = threading.Thread(target=generation_loop, daemon=True)
    generator_thread.start()
    
    return jsonify({"status": "started", "message": "Incident generator started"}), 200

@app.route('/api/stop', methods=['POST'])
def stop_generator():
    """Stop the incident generator."""
    global is_running, stop_flag
    
    if not is_running:
        return jsonify({"status": "not_running", "message": "Generator is not running"}), 200
    
    stop_flag.set()
    return jsonify({"status": "stopped", "message": "Incident generator stopping..."}), 200

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get the current status of the generator."""
    return jsonify({"is_running": is_running}), 200

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    print("🎮 Incident Generator API starting on port 9000...")
    app.run(host='0.0.0.0', port=9000, debug=False)
