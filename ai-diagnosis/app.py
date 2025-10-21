from fastapi import FastAPI
from pydantic import BaseModel
import os, json, re
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = FastAPI(title="AI Diagnosis Service (Gemini 2.5 Flash)", version="1.6")

# The client automatically gets the API key from the environment variable `GEMINI_API_KEY`
client = genai.Client()

# --- Data Models ---
class IncidentRequest(BaseModel):
    description: str

class DiagnosisResponse(BaseModel):
    diagnosis: str
    severity: str

class SuggestedFixResponse(BaseModel):
    suggested_fix: str
    confidence: float


# --- Helper Functions ---
def clean_json_string(s: str) -> str:
    """Removes markdown code fences and whitespace from a string to extract raw JSON."""
    # Find the start and end of the JSON object
    match = re.search(r'\{.*\}', s, re.DOTALL)
    if match:
        return match.group(0)
    return s.strip() # Fallback for strings that might not have fences

def call_gemini(prompt: str) -> str:
    """Calls the Gemini API using the SDK's client.models.generate_content method."""
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"Gemini API SDK error: {e}")
        return '{"error":"AI request failed"}'


# --- Routes ---
@app.post("/api/v1/diagnosis", response_model=DiagnosisResponse)
def get_diagnosis(req: IncidentRequest):
    prompt = f"""
    You are an AI diagnosing software incidents.
    Given this description: "{req.description}"
    Respond ONLY in valid JSON with keys "diagnosis" (string) and "severity" ("low"|"medium"|"high").
    """
    raw = call_gemini(prompt)
    cleaned_raw = clean_json_string(raw)

    try:
        parsed = json.loads(cleaned_raw)
        severity = parsed.get("severity", "medium").lower()
        if severity not in ["low", "medium", "high"]:
            severity = "medium"
        return DiagnosisResponse(diagnosis=parsed.get("diagnosis", cleaned_raw), severity=severity)
    except Exception:
        return DiagnosisResponse(diagnosis=cleaned_raw, severity="medium")


@app.post("/api/v1/suggested-fix", response_model=SuggestedFixResponse)
def get_suggested_fix(req: IncidentRequest):
    prompt = f"""
    You are a Site Reliability Engineer suggesting a fix for an incident.
    Incident: "{req.description}"
    Respond ONLY in valid JSON with keys "suggested_fix" (string) and "confidence" (float between 0.0 and 1.0).
    """
    raw = call_gemini(prompt)
    cleaned_raw = clean_json_string(raw)

    try:
        parsed = json.loads(cleaned_raw)
        confidence = float(parsed.get("confidence", 0.7))
        confidence = max(0.0, min(confidence, 1.0))
        return SuggestedFixResponse(
            suggested_fix=parsed.get("suggested_fix", cleaned_raw),
            confidence=confidence
        )
    except Exception:
        return SuggestedFixResponse(suggested_fix=cleaned_raw, confidence=0.7)


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}
