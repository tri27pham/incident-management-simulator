from fastapi import FastAPI
from pydantic import BaseModel
import os, json, re
from dotenv import load_dotenv
from google import genai
from groq import Groq

load_dotenv()

app = FastAPI(title="AI Diagnosis Service (Groq → Gemini Fallback)", version="2.0")

# Initialize AI clients
gemini_api_key = os.getenv("GEMINI_API_KEY")
groq_api_key = os.getenv("GROQ_API_KEY")

gemini_client = genai.Client() if gemini_api_key else None
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

# Log which AI services are available
if groq_client:
    print("✅ Groq API configured (PRIMARY)")
if gemini_client:
    print("✅ Gemini API configured (FALLBACK)")
if not groq_client and not gemini_client:
    print("⚠️  WARNING: No AI API keys configured!")

# --- Data Models ---
class IncidentRequest(BaseModel):
    description: str

class DiagnosisResponse(BaseModel):
    diagnosis: str
    severity: str
    provider: str = "unknown"  # "gemini", "groq", "error"

class SuggestedFixResponse(BaseModel):
    suggested_fix: str
    confidence: float
    provider: str = "unknown"  # "gemini", "groq", "error"


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
    if not gemini_client:
        raise Exception("Gemini API key not configured")
    
    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        error_str = str(e)
        print(f"Gemini API SDK error: {e}")
        
        # Check for specific Gemini API errors
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
            raise Exception("Gemini API rate limit exceeded")
        elif "503" in error_str or "UNAVAILABLE" in error_str or "overloaded" in error_str.lower():
            raise Exception("Gemini API is currently overloaded")
        elif "quota" in error_str.lower():
            raise Exception("Gemini API quota exceeded")
        elif "API key" in error_str or "authentication" in error_str.lower():
            raise Exception("Gemini API authentication failed")
        else:
            raise Exception(f"Gemini API error: {error_str}")

def call_groq(prompt: str) -> str:
    """Calls the Groq API as a fallback."""
    if not groq_client:
        raise Exception("Groq API key not configured")
    
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # Fast, high-quality model
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        error_str = str(e)
        print(f"Groq API error: {e}")
        raise Exception(f"Groq API error: {error_str}")

def call_ai_with_fallback(prompt: str) -> tuple[str, str]:
    """Tries Groq first, falls back to Gemini if it fails. Returns (result, provider)."""
    # Try Groq first (PRIMARY)
    if groq_client:
        try:
            result = call_groq(prompt)
            print("✅ Used Groq API (primary)")
            return (result, "groq")
        except Exception as groq_error:
            print(f"⚠️  Groq failed: {groq_error}")
    
    # Try Gemini as fallback (SECONDARY)
    if gemini_client:
        try:
            result = call_gemini(prompt)
            print("✅ Used Gemini API (fallback)")
            return (result, "gemini")
        except Exception as gemini_error:
            print(f"❌ Gemini also failed: {gemini_error}")
    
    # If both failed or neither is configured
    if not groq_client and not gemini_client:
        return ('{"error":"No AI services configured. Please set GROQ_API_KEY or GEMINI_API_KEY."}', "error")
    else:
        return ('{"error":"All AI services unavailable. Please try again later."}', "error")


# --- Routes ---
@app.post("/api/v1/diagnosis", response_model=DiagnosisResponse)
def get_diagnosis(req: IncidentRequest):
    prompt = f"""
    You are an AI diagnosing software incidents.
    Given this description: "{req.description}"
    Respond ONLY in valid JSON with keys "diagnosis" (string) and "severity" ("low"|"medium"|"high").
    """
    
    # Try with garbage detection
    max_attempts = 2
    for attempt in range(max_attempts):
        raw, provider = call_ai_with_fallback(prompt)
        
        # Check for garbage
        if not is_valid_incident_response(raw):
            print(f"⚠️  Diagnosis attempt {attempt + 1}: Got garbage, retrying...")
            if attempt < max_attempts - 1:
                continue
            else:
                return DiagnosisResponse(
                    diagnosis="AI service returned invalid response. Please try again.",
                    severity="medium",
                    provider="error"
                )
        
        cleaned_raw = clean_json_string(raw)

        try:
            parsed = json.loads(cleaned_raw)
            
            # Check if there's an error from AI services
            if "error" in parsed:
                return DiagnosisResponse(diagnosis=parsed["error"], severity="medium", provider="error")
            
            severity = parsed.get("severity", "medium").lower()
            if severity not in ["low", "medium", "high"]:
                severity = "medium"
            
            diagnosis_text = parsed.get("diagnosis", cleaned_raw)
            
            # Final check: diagnosis should be reasonable length
            if 10 < len(diagnosis_text) < 2000:
                return DiagnosisResponse(diagnosis=diagnosis_text, severity=severity, provider=provider)
            
        except Exception as e:
            print(f"⚠️  Diagnosis parsing error: {e}")
            if attempt < max_attempts - 1:
                continue
    
    # Final fallback
    return DiagnosisResponse(
        diagnosis="Unable to generate diagnosis. Please try again.",
        severity="medium",
        provider="error"
    )


@app.post("/api/v1/suggested-fix", response_model=SuggestedFixResponse)
def get_suggested_fix(req: IncidentRequest):
    prompt = f"""
    You are a Site Reliability Engineer suggesting a fix for an incident.
    Incident: "{req.description}"
    Respond ONLY in valid JSON with keys "suggested_fix" (string) and "confidence" (float between 0.0 and 1.0).
    """
    
    # Try with garbage detection
    max_attempts = 2
    for attempt in range(max_attempts):
        raw, provider = call_ai_with_fallback(prompt)
        
        # Check for garbage
        if not is_valid_incident_response(raw):
            print(f"⚠️  Solution attempt {attempt + 1}: Got garbage, retrying...")
            if attempt < max_attempts - 1:
                continue
            else:
                return SuggestedFixResponse(
                    suggested_fix="AI service returned invalid response. Please try again.",
                    confidence=0.0,
                    provider="error"
                )
        
        cleaned_raw = clean_json_string(raw)

        try:
            parsed = json.loads(cleaned_raw)
            
            # Check if there's an error from AI services
            if "error" in parsed:
                return SuggestedFixResponse(suggested_fix=parsed["error"], confidence=0.0, provider="error")
            
            confidence = float(parsed.get("confidence", 0.7))
            confidence = max(0.0, min(confidence, 1.0))
            
            solution_text = parsed.get("suggested_fix", cleaned_raw)
            
            # Final check: solution should be reasonable length
            if 10 < len(solution_text) < 2000:
                return SuggestedFixResponse(
                    suggested_fix=solution_text,
                    confidence=confidence,
                    provider=provider
                )
            
        except Exception as e:
            print(f"⚠️  Solution parsing error: {e}")
            if attempt < max_attempts - 1:
                continue
    
    # Final fallback
    return SuggestedFixResponse(
        suggested_fix="Unable to generate solution. Please try again.",
        confidence=0.0,
        provider="error"
    )


def is_valid_incident_response(text: str) -> bool:
    """Check if the response looks like valid incident data (not garbage)."""
    if not text or len(text) < 10:
        return False
    
    # Check for garbage patterns (repeated tokens, strange words)
    garbage_indicators = [
        'externalActionCode', 'BuilderFactory', 'visitInsn', 'roscope',
        'RODUCTION', 'slider', 'Injected', 'contaminants', 'exposition'
    ]
    
    # If response contains multiple garbage indicators, it's bad
    garbage_count = sum(1 for indicator in garbage_indicators if indicator in text)
    if garbage_count > 2:
        return False
    
    # Check if it's mostly ASCII and reasonable
    try:
        # Valid JSON should have quotes and braces
        if '{' not in text or '"' not in text:
            return False
        return True
    except:
        return False

@app.post("/api/v1/generate-incident")
def generate_incident():
    """Generate a random incident using AI."""
    prompt = """Generate a realistic software incident. 
    
    Respond with ONLY valid JSON (no explanations, no markdown):
    {
      "message": "A specific incident description like 'API Gateway returning 503 errors for EU users'",
      "source": "A service name like 'api-gateway' or 'postgres-db'"
    }
    
    Make it realistic and varied. Do NOT include any other text."""
    
    # Try to get a valid response (retry up to 2 times if we get garbage)
    max_attempts = 2
    for attempt in range(max_attempts):
        try:
            raw, provider = call_ai_with_fallback(prompt)
            
            # Check if response looks valid
            if not is_valid_incident_response(raw):
                print(f"⚠️  Attempt {attempt + 1}: Got garbage response, retrying...")
                if attempt < max_attempts - 1:
                    continue
                else:
                    print("❌ All attempts failed, using fallback")
                    break
            
            # Clean the response
            cleaned = clean_json_string(raw)
            parsed = json.loads(cleaned)
            
            # Validate required fields and content quality
            if "message" in parsed and "source" in parsed:
                message = str(parsed["message"])
                source = str(parsed["source"])
                
                # Basic validation: message should be reasonable length
                if 10 < len(message) < 500 and 3 < len(source) < 100:
                    return {
                        "message": message,
                        "source": source,
                        "provider": provider
                    }
            
            print(f"⚠️  Attempt {attempt + 1}: Invalid format, retrying...")
            
        except Exception as e:
            print(f"⚠️  Attempt {attempt + 1} error: {e}")
            if attempt < max_attempts - 1:
                continue
    
    # Fallback to hardcoded incident if all else fails
    import random
    fallback_incidents = [
        {"message": "API Gateway returning 503 errors - service unavailable", "source": "api-gateway"},
        {"message": "Database connection pool exhausted - queries timing out", "source": "postgres-primary"},
        {"message": "Redis cache cluster down - failover not working", "source": "redis-cluster"},
        {"message": "Authentication service high latency - 5s response time", "source": "auth-service"},
        {"message": "Kubernetes pods stuck in CrashLoopBackOff - OOM errors", "source": "k8s-cluster"},
    ]
    incident = random.choice(fallback_incidents)
    return {
        "message": incident["message"],
        "source": incident["source"],
        "provider": "fallback"
    }

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}
