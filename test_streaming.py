import requests
import json

def test_streaming():
    url = "http://localhost:8000/chat"
    payload = {"message": "Hola"}
    
    print("Sending request to API...")
    try:
        with requests.post(url, json=payload, stream=True) as response:
            if response.status_code == 200:
                print("Connected. Receiving stream...")
                for line in response.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        print(f"Received: {decoded_line}")
            else:
                print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_streaming()
