import os
import time
import requests
import json
import random
import re
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

# Configure the Gemini client
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Get the backend URL from an environment variable, with a fallback for local dev
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8080")
INCIDENTS_ENDPOINT = f"{BACKEND_URL}/api/v1/incidents"

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

def main():
    """Main loop to generate and report incidents periodically."""
    print("🚀 Incident Generator started. Press Ctrl+C to stop.")
    print(f"➡️ Reporting incidents to: {INCIDENTS_ENDPOINT}")
    
    # Wait for a few seconds before starting to give the backend time to initialize
    time.sleep(10)
    
    while True:
        incident = generate_incident()
        if incident:
            report_incident(incident)
        
        # Wait for a random interval before generating the next incident
        sleep_duration = random.randint(15, 45)
        print(f"🕒 Waiting for {sleep_duration} seconds...")
        time.sleep(sleep_duration)

if __name__ == "__main__":
    main()
