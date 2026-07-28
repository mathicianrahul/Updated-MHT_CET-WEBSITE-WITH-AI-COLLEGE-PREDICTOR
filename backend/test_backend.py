from fastapi.testclient import TestClient
from main import app, map_seat_categories

client = TestClient(app)

def test_map_seat_categories():
    cats = map_seat_categories("OBC", "Male", True, False, False)
    assert "GOBCH" in cats
    assert "GOPENS" in cats
    assert "GOPENH" in cats
    assert "GOBCS" in cats
    assert "LOBCH" not in cats
    assert "AI (JEE)" not in cats

    cats = map_seat_categories("Open", "Female", False, False, False)
    assert "GOPENO" in cats
    assert "LOPENO" in cats
    assert "GOPENS" in cats
    assert "LOPENS" in cats
    assert "GOBCO" not in cats
    assert "AI (JEE)" not in cats

    ai_cats = map_seat_categories("All India (AI / JEE)", "Male", False, False, False)
    assert "AI (JEE)" in ai_cats or "AI" in ai_cats

    print("map_seat_categories tests passed!")

def test_metadata_endpoint():
    response = client.get("/api/metadata")
    assert response.status_code == 200
    data = response.json()
    assert "cities" in data
    assert "universities" in data
    assert "branches" in data
    assert "categories" in data
    assert "cap_rounds" in data
    assert len(data["cities"]) > 10
    assert len(data["universities"]) >= 5
    assert len(data["branches"]) >= 10
    print(f"Metadata endpoint test passed! ({len(data['cities'])} cities, {len(data['universities'])} universities, {len(data['branches'])} branches)")

def test_predict_endpoint():
    payload = {
        "percentile": 92.5,
        "category": "OBC",
        "gender": "Male",
        "home_university": "Savitribai Phule Pune University",
        "preferred_cities": ["Pune", "Mumbai"],
        "preferred_branches": ["Computer Engineering", "Information Technology"]
    }
    
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    items = res_data.get("results", res_data if isinstance(res_data, list) else [])
    print(f"Number of predicted options: {len(items)}")
    
    if items:
        sample = items[0]
        assert "college_name" in sample
        assert "city" in sample
        assert "branch_name" in sample
        assert "closing_cutoff" in sample
        assert "status" in sample
        
    print("predict endpoint test passed!")

def test_pcm_excludes_ai_jee():
    pcm_payload = {
        "percentile": 92.5,
        "category": "Open",
        "gender": "Male",
        "home_university": "Savitribai Phule Pune University",
        "exam_type": "MHT-CET"
    }
    res = client.post("/api/predict", json=pcm_payload).json()
    pcm_items = res.get("results", [])
    jee_in_pcm = [item for item in pcm_items if "JEE" in item.get("seat_category", "")]
    assert len(jee_in_pcm) == 0, f"PCM list contained {len(jee_in_pcm)} AI JEE cutoffs!"

    jee_payload = {
        "percentile": 92.5,
        "category": "All India (AI / JEE)",
        "gender": "Male",
        "home_university": "Savitribai Phule Pune University",
        "exam_type": "JEE-Main"
    }
    res_jee = client.post("/api/predict", json=jee_payload).json()
    jee_items = res_jee.get("results", [])
    jee_in_jee = [item for item in jee_items if "JEE" in item.get("seat_category", "")]
    assert len(jee_in_jee) > 0, "JEE list should contain AI (JEE) cutoffs!"

    print("test_pcm_excludes_ai_jee passed! Zero AI JEE cutoffs for PCM, AI JEE included for JEE.")

def test_gender_filtering():
    male_payload = {
        "percentile": 90.0,
        "category": "Open",
        "gender": "Male",
        "home_university": "Savitribai Phule Pune University"
    }
    res_m = client.post("/api/predict", json=male_payload).json()
    items_m = res_m.get("results", [])
    ladies_in_male = [item for item in items_m if item.get("seat_category", "").startswith("L")]
    assert len(ladies_in_male) == 0, f"Male student list contained {len(ladies_in_male)} Ladies quota seats!"

    female_payload = {
        "percentile": 90.0,
        "category": "Open",
        "gender": "Female",
        "home_university": "Savitribai Phule Pune University"
    }
    res_f = client.post("/api/predict", json=female_payload).json()
    items_f = res_f.get("results", [])
    ladies_in_female = [item for item in items_f if item.get("seat_category", "").startswith("L")]
    assert len(ladies_in_female) > 0, "Female student list should contain Ladies quota seats!"

    print(f"test_gender_filtering passed! Male gets 0 Ladies seats, Female gets {len(ladies_in_female)} Ladies seats.")

def test_pwd_and_defense_filtering():
    normal_payload = {
        "percentile": 90.0,
        "category": "OBC",
        "gender": "Male",
        "home_university": "Savitribai Phule Pune University",
        "is_pwd": False,
        "is_defense": False
    }
    res_norm = client.post("/api/predict", json=normal_payload).json()
    items_norm = res_norm.get("results", [])
    pwd_in_norm = [i for i in items_norm if "PWD" in i.get("seat_category", "")]
    def_in_norm = [i for i in items_norm if "DEF" in i.get("seat_category", "")]
    assert len(pwd_in_norm) == 0, f"Non-PWD candidate got {len(pwd_in_norm)} PWD seats!"
    assert len(def_in_norm) == 0, f"Non-DEF candidate got {len(def_in_norm)} DEF seats!"

    pwd_payload = dict(normal_payload, is_pwd=True)
    res_pwd = client.post("/api/predict", json=pwd_payload).json()
    items_pwd = res_pwd.get("results", [])
    pwd_seats = [i for i in items_pwd if "PWD" in i.get("seat_category", "")]
    assert len(pwd_seats) > 0, "PWD candidate should receive PWD reserved seats!"

    def_payload = dict(normal_payload, is_defense=True)
    res_def = client.post("/api/predict", json=def_payload).json()
    items_def = res_def.get("results", [])
    def_seats = [i for i in items_def if "DEF" in i.get("seat_category", "")]
    assert len(def_seats) > 0, "Defense candidate should receive Defense reserved seats!"

    print(f"test_pwd_and_defense_filtering passed! PWD candidate gets {len(pwd_seats)} PWD seats, DEF candidate gets {len(def_seats)} DEF seats.")

def test_cap_round_filtering():
    cap2_payload = {
        "percentile": 92.0,
        "category": "Open",
        "gender": "Male",
        "home_university": "Savitribai Phule Pune University",
        "cap_round": "CAP Round 2"
    }
    res = client.post("/api/predict", json=cap2_payload).json()
    items = res.get("results", [])
    non_cap2 = [item for item in items if item.get("cap_round") != "CAP Round 2"]
    assert len(non_cap2) == 0, f"CAP Round 2 query returned {len(non_cap2)} non-Round 2 items!"
    assert len(items) > 0, "CAP Round 2 query returned 0 items!"

    print(f"test_cap_round_filtering passed! All {len(items)} items strictly belong to CAP Round 2.")

if __name__ == "__main__":
    test_map_seat_categories()
    test_metadata_endpoint()
    test_predict_endpoint()
    test_pcm_excludes_ai_jee()
    test_gender_filtering()
    test_pwd_and_defense_filtering()
    test_cap_round_filtering()
