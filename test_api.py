import requests
import time

def test_chat():
    url = "http://localhost:8000/chat"
    payload = {"message": "¿Qué es el sistema solar?"}
    
    print("Sending request to API...")
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            print("\nResponse:", data["response"])
            print("Sources:", data["sources"])
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    # Wait for server to start
    time.sleep(5) 
    test_chat()
