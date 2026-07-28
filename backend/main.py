import os
import re
from contextlib import asynccontextmanager
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Union

DATA_PATH = os.path.dirname(os.path.abspath(__file__))
MERGED_DATA: pd.DataFrame = pd.DataFrame()

JEE_AI_CATEGORIES = ["AI", "AI (JEE)", "AI (JEE(Main)-2025)"]
MHT_CET_AI_CATEGORIES = ["AI (MHT-CET)", "AI (MHT-CET-PCM 2025)"]

CITY_ALIASES = {
    "Mumbai": ["Mumbai", "Navi Mumbai", "Thane"],
    "Pune": ["Pune", "Pimpri-Chinchwad"],
    "Nashik": ["Nashik"],
    "Dhule": ["Dhule"],
    "Jalgaon": ["Jalgaon"],
    "Shirpur": ["Shirpur"]
}

GOVT_CODES = {
    '1001', '1002', '1005', '1012', '16006',
    '2001', '2002', '2006', '2008', '2020', '2021', '2032',
    '3012', '3014', '3033', '3036', '3042',
    '4001', '4002', '4004', '4025', '14005',
    '5003', '5004',
    '6001', '6004', '6005', '6006', '6007', '6008', '6028', '6036'
}

GOVT_EXACT_KEYWORDS = [
    'government college', 'govt college', 'government engineering', 'govt engineering',
    'coep technological university', 'college of engineering, pune',
    'veermata jijabai technological institute', 'vjti',
    'institute of chemical technology', 'ict, mumbai', 'ict, jalna',
    'shri guru gobind singhji institute', 'sggs',
    'laxminarayan innovation technological university', 'litu',
    'dr. babasaheb ambedkar technological university', 'dbatu',
    'department of technology, shivaji', 'department of technology, savitribai',
    'university department of chemical technology', 'university institute of chemical technology',
    'sant gadge baba amravati university',
    'walchand college of engineering, sangli',
    'sardar patel college of engineering, andheri'
]

PRIVATE_TRUST_KEYWORDS = [
    'pimpri chinchwad', 'pccoe', 'modern education', 'progressive education', 
    'all india shri shivaji', 'aissms', 'wadia', 'sinhgad', 'mit ', 'mit,', 'mit\'s', 
    'd.y. patil', 'd.y.patil', 'dy patil', 'jspm', 'pcet', 'raisoni', 'somaiya', 
    'zeal', 'indira', 'alard', 'moze', 'trinity', 'kjei', 'tssm', 'bhivarabai', 
    'rajarshi shahu', 'siddhant', 'marathwada mitra mandal', 'mmcoe', 'mmit', 
    'genba moze', 'r.h. sapat', 'sapkal', 'shatabdi', 'matoshri', 'jamia', 
    'maulana mukhtar', 's.b. patil', 'navsahyadri', 'universal', 'dattakala', 
    'samarth', 'n. b. navale', 'skn sinhgad', 'international institute of information technology', 
    'i²it', 'i2it', 'k. j. somaiya', 'k j somaiya', 'vilasrao deshmukh', 'wainganga', 
    'k.d.k.', 'tulsiramji gaikwad', 'shreeyash', 'g. s. mandal', 'deogiri', 'm.s. bidve', 
    'terna', 'tuljabhavani', 'peoples education', 'hi-tech', 'aditya', 'nagnathappa halge', 
    'matsyodari', 'k. t. patil', 'vishweshwarayya', 'aurangabad college', 'mitthulalji sarada', 
    'shri sant gajanan', 'prof. ram meghe', 'p. r. pote', 'sipna', 'shri shivaji education', 
    'anuradha', 'jawaharlal darda', 'shri hanuman', 'pvgs', 'pvg\'s', 'dr. j. j. magdum', 
    'annasaheb dange', 'vidya pratishthan', 'dhole patil', 'nutan maharashtra', 'shahajirao patil', 
    'k.j.\'s', 'jaihind', 'isbm', 'd.y.patil', 'pict', 'pune institute of computer technology',
    'vishwakarma', 'vit', 'viit', 'thakur', 'pillai', 'fr. conceicao', 'don bosco', 'rizvi',
    'sardar patel institute of technology', 'spit'
]

def classify_institute_type(college_code, college_name) -> str:
    code_str = str(college_code).strip()
    name_lower = str(college_name).strip().lower()

    if any(pk in name_lower for pk in PRIVATE_TRUST_KEYWORDS):
        return "PRIVATE"
    
    if any(gk in name_lower for gk in GOVT_EXACT_KEYWORDS) or code_str in GOVT_CODES:
        return "Government"
        
    return "PRIVATE"

def clean_int_code(val) -> str:
    if pd.isna(val) or val is None:
        return ""
    try:
        f = float(val)
        return str(int(f))
    except (ValueError, TypeError):
        s = str(val).strip()
        if s.endswith(".0"):
            return s[:-2]
        return s

def clean_branch_name(name: str) -> str:
    if not name or pd.isna(name):
        return ""
    
    s = str(name).strip()

    overrides = {
        "Computer Science And Engineering (Artificial": "Computer Science And Engineering (Artificial Intelligence)",
        "Computer Science And Engineering(Artificial": "Computer Science And Engineering (Artificial Intelligence)",
        "Computer Science And Engineering (Cyber": "Computer Science And Engineering (Cyber Security)",
        "Computer Science And Engineering(Cyber": "Computer Science And Engineering (Cyber Security)",
        "Computer Science And Engineering (Internet Of": "Computer Science And Engineering (Internet Of Things)",
        "Electronics Engineering ( Research Vlsi Design And": "Electronics Engineering (VLSI Design And Technology)",
        "Electronics Engineering ( Vlsi Design And": "Electronics Engineering (VLSI Design And Technology)",
        "Electronics Engineering ( Vlsi Design And Technology)": "Electronics Engineering (VLSI Design And Technology)",
        "Electronics And Communication(Advanced": "Electronics And Communication (Advanced Communication Technology)",
    }
    if s in overrides:
        return overrides[s]

    patterns = [
        (r"Artificial Intelligence \(Ai\).*?And Data Science", "Artificial Intelligence (Ai) And Data Science"),
        (r"Artificial Intelligence And.*?Data Science", "Artificial Intelligence And Data Science"),
        (r"Artificial Intelligence And.*?Machine Learning", "Artificial Intelligence And Machine Learning"),
        (r"Automation And Robotics.*", "Automation And Robotics"),
        (r"Bio Medical Engineering.*", "Bio Medical Engineering"),
        (r"Bio Technology Engineering.*", "Bio Technology"),
        (r"Bio Technology.*", "Bio Technology"),
        (r"Civil Engineering \(Structural Engineering\)", "Civil Engineering (Structural Engineering)"),
        (r"Civil And Environmental Engineering", "Civil And Environmental Engineering"),
        (r"Civil And Infrastructure Engineering", "Civil And Infrastructure Engineering"),
        (r"Civil Engineering With Computer Application", "Civil Engineering With Computer Application"),
        (r"Civil Engineering.*", "Civil Engineering"),
        (r"Computer Engineering \(Regional Language\)", "Computer Engineering (Regional Language)"),
        (r"Computer Engineering \(Software Engineering\)", "Computer Engineering (Software Engineering)"),
        (r"Computer Engineering And Science.*", "Computer Engineering And Science"),
        (r"Computer Engineering.*", "Computer Engineering"),
        (r"Computer Science And Business Systems.*", "Computer Science And Business Systems"),
        (r"Computer Science And Design.*", "Computer Science And Design"),
        (r"Computer Science And Engineering \(Artificial Intelligence And Data Science\)", "Computer Science And Engineering (Artificial Intelligence And Data Science)"),
        (r"Computer Science And Engineering \(Artificial Intelligence And Machine Learning\)", "Computer Science And Engineering (Artificial Intelligence And Machine Learning)"),
        (r"Computer Science And Engineering \(Artificial Intelligence\)", "Computer Science And Engineering (Artificial Intelligence)"),
        (r"Computer Science And Engineering \(Cyber Security\)", "Computer Science And Engineering (Cyber Security)"),
        (r"Computer Science And Engineering \(Data Science\)", "Computer Science And Engineering (Data Science)"),
        (r"Computer Science And Engineering \(Internet Of Things And Cyber Security Including Block Chain", "Computer Science And Engineering (Internet Of Things And Cyber Security Including Block Chain)"),
        (r"Computer Science And Engineering \(Internet Of Things\)", "Computer Science And Engineering (Internet Of Things)"),
        (r"Computer Science And Engineering \(Iot\)", "Computer Science And Engineering (IoT)"),
        (r"Computer Science And Engineering\(Artificial Intelligence And Machine Learning\)", "Computer Science And Engineering (Artificial Intelligence And Machine Learning)"),
        (r"Computer Science And Engineering\(Cyber Security\)", "Computer Science And Engineering (Cyber Security)"),
        (r"Computer Science And Engineering\(Data Science\)", "Computer Science And Engineering (Data Science)"),
        (r"Computer Science And Engineering.*?", "Computer Science And Engineering"),
        (r"Computer Science And Information Technology.*", "Computer Science And Information Technology"),
        (r"Computer Science And Technology.*", "Computer Science And Technology"),
        (r"Computer Science And.*?", "Computer Science And Engineering"),
        (r"Computer Technology.*", "Computer Technology"),
        (r"Electrical And Computer Engineering.*", "Electrical And Computer Engineering"),
        (r"Electrical And Electronics Engineering.*", "Electrical And Electronics Engineering"),
        (r"Electrical Engg\[Electronics.*", "Electrical Engg[Electronics And Power]"),
        (r"Electrical, Electronics And Power", "Electrical, Electronics And Power"),
        (r"Electrical Engineering.*", "Electrical Engineering"),
        (r"Electronics & Telecommunication Engineering", "Electronics & Telecommunication Engineering"),
        (r"Electronics & Telecommunication", "Electronics & Telecommunication Engineering"),
        (r"Electronics And Biomedical Engineering", "Electronics And Biomedical Engineering"),
        (r"Electronics And Communication \(Advanced Communication Technology\)", "Electronics And Communication (Advanced Communication Technology)"),
        (r"Electronics And Communication Engineering \(Bio-Medical Engineering\)", "Electronics And Communication Engineering (Bio-Medical Engineering)"),
        (r"Electronics And Communication Engineering", "Electronics And Communication Engineering"),
        (r"Electronics And .*?Communication", "Electronics And Communication Engineering"),
        (r"Electronics And Computer Science", "Electronics And Computer Science"),
        (r"Electronics And Computer.*", "Electronics And Computer Engineering"),
        (r"Electronics And .*?Telecommunication Engg.*", "Electronics And Telecommunication Engg"),
        (r"Electronics Engineering \(.*VLSI Design.*", "Electronics Engineering (VLSI Design And Technology)"),
        (r"Electronics Engineering.*", "Electronics Engineering"),
        (r"Information Technology.*", "Information Technology"),
        (r"Instrumentation And Control Engineering", "Instrumentation And Control Engineering"),
        (r"Instrumentation.*", "Instrumentation Engineering"),
        (r"Mechanical & Automation Engineering", "Mechanical & Automation Engineering"),
        (r"Mechanical And Automation Engineering", "Mechanical And Automation Engineering"),
        (r"Mechanical And Mechatronics Engineering \(Additive Manufacturing\)", "Mechanical And Mechatronics Engineering (Additive Manufacturing)"),
        (r"Mechanical And Mechatronics Engineering", "Mechanical And Mechatronics Engineering"),
        (r"Mechanical And Rail Engineering", "Mechanical And Rail Engineering"),
        (r"Mechanical Engineering \(Automobile\)", "Mechanical Engineering (Automobile)"),
        (r"Mechanical Engineering Automobile.*", "Mechanical Engineering (Automobile)"),
        (r"Mechanical Engineering\[Sandwich\]", "Mechanical Engineering [Sandwich]"),
        (r"Mechanical Engineering.*", "Mechanical Engineering"),
        (r"Structural Engineering.*", "Structural Engineering"),
        (r"Automobile Engineering.*", "Automobile Engineering"),
        (r"Fashion Technology.*", "Fashion Technology"),
        (r"Food Engineering And Technology", "Food Engineering And Technology"),
        (r"Food Engineering.*", "Food Engineering"),
        (r"Food Technology And Management", "Food Technology And Management"),
        (r"Food Technology.*", "Food Technology"),
        (r"Mechatronics Engineering.*", "Mechatronics Engineering"),
        (r"Production Engineering\[Sandwich\]", "Production Engineering [Sandwich]"),
        (r"Production Engineering.*", "Production Engineering"),
        (r"Robotics And Artificial Intelligence", "Robotics And Artificial Intelligence"),
        (r"Robotics And Automation", "Robotics And Automation"),
        (r"Textile Chemistry.*", "Textile Chemistry"),
        (r"Textile Engineering / Technology", "Textile Engineering / Technology"),
        (r"Textile Technology.*", "Textile Technology"),
    ]
    
    for pat, repl in patterns:
        if re.match(pat, s, re.IGNORECASE):
            return repl

    cleaned = re.sub(r"\s+(?:Pune|Mumbai|Nagpur|Nashik|Solapur|Chandrapur|Barshi|Vevoor|Palghar|Kamshet|Amravati|Yavatmal|Kashti|Someshwar|Neral|Karjat|Nepti|Tathawade|Kharghar|Vadgaon|Wagholi|Hadapsar|Sion|Bibwewadi|Ichalkaranji|Boisar|Chopda|Asangaon|Thane|Dhule|Parbhani|Pisoli|Babulgaon|Warananagar|Yadrav|Kopargaon)\.?$", "", s, flags=re.IGNORECASE)
    
    return cleaned.strip()

def load_data():
    global MERGED_DATA
    mh_file = os.path.join(DATA_PATH, "Overall_MH_CAP_Cutoff_2025-26.csv")
    ai_file = os.path.join(DATA_PATH, "Overall_AI_CAP_Cutoff_2025-26.csv")

    dfs = []
    required_cols = [
        'College Code', 'College Name', 'City', 'Institute Type', 'Status', 
        'University', 'Home University', 'Branch Code', 'Branch Name', 
        'Seat Category', 'Closing Rank', 'Closing Percentile', 'CAP Round', 'PDF Page Number'
    ]

    if os.path.exists(mh_file):
        try:
            df_mh = pd.read_csv(mh_file)
            df_mh['Source_CSV'] = "MH"
            for col in required_cols:
                if col not in df_mh.columns:
                    df_mh[col] = None
            dfs.append(df_mh)
        except Exception as e:
            print(f"Error reading MH file {mh_file}: {e}")

    if os.path.exists(ai_file):
        try:
            df_ai = pd.read_csv(ai_file)
            df_ai['Source_CSV'] = "AI"
            for col in required_cols:
                if col not in df_ai.columns:
                    df_ai[col] = None
            dfs.append(df_ai)
        except Exception as e:
            print(f"Error reading AI file {ai_file}: {e}")

    if dfs:
        MERGED_DATA = pd.concat(dfs, ignore_index=True)
        MERGED_DATA['Closing Percentile'] = pd.to_numeric(MERGED_DATA['Closing Percentile'], errors='coerce')
        MERGED_DATA['Closing Rank'] = pd.to_numeric(MERGED_DATA['Closing Rank'], errors='coerce')
        MERGED_DATA['CAP Round'] = pd.to_numeric(MERGED_DATA['CAP Round'], errors='coerce')
        MERGED_DATA = MERGED_DATA.dropna(subset=['Closing Percentile', 'Seat Category'])
        
        for col in ['City', 'College Name', 'Branch Name', 'Seat Category', 'Home University', 'University', 'Institute Type', 'Status', 'Source_CSV']:
            if col in MERGED_DATA.columns:
                MERGED_DATA[col] = MERGED_DATA[col].astype(str).str.strip()
        
        MERGED_DATA['Branch Name'] = MERGED_DATA['Branch Name'].apply(clean_branch_name)
        print(f"Data loaded successfully from Overall CSV files. Total records: {len(MERGED_DATA)}")
    else:
        MERGED_DATA = pd.DataFrame()

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_data()
    yield

app = FastAPI(title="MHT-CET CAP Counselling API", lifespan=lifespan)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    student_name: Optional[str] = ""
    percentile: float
    category: str
    gender: str
    home_university: str
    exam_type: Optional[str] = "MHT-CET"
    cap_round: Optional[str] = "CAP Round 1"
    preferred_cities: Optional[List[str]] = []
    preferred_branches: Optional[List[str]] = []
    is_pwd: bool = False
    is_defense: bool = False
    sort_by: Optional[Union[str, List[str]]] = "cutoff"

@app.get("/api/metadata")
def get_metadata():
    if MERGED_DATA.empty:
        load_data()
        if MERGED_DATA.empty:
            return {"cities": [], "universities": [], "branches": [], "categories": [], "cap_rounds": []}

    raw_cities = MERGED_DATA['City'].dropna().unique().tolist()
    cities = []
    for c in raw_cities:
        c_str = str(c).strip()
        if not c_str or c_str.lower() in ['nan', 'none']:
            continue
        if any(k in c_str.lower() for k in ['college of', 'institute of', 'nextgen technical', 'group of institutions']):
            continue
        cities.append(c_str)
    TOP_CITY_PRIORITY = [
        "Pune", "Mumbai", "Navi Mumbai", "Thane", "Pimpri-Chinchwad",
        "Nashik", "Nagpur", "Aurangabad", "Chhatrapati Sambhajinagar",
        "Kolhapur", "Solapur", "Sangli", "Jalgaon", "Amravati",
        "Dhule", "Shirpur", "Nanded", "Latur", "Satara", "Ratnagiri",
        "Ahmednagar", "Akola", "Buldhana", "Yavatmal", "Chandrapur"
    ]
    city_rank = {c.lower(): idx for idx, c in enumerate(TOP_CITY_PRIORITY)}

    def city_sort_key(c_name):
        return (city_rank.get(c_name.lower(), 999), c_name)

    cities = sorted(list(set(cities)), key=city_sort_key)

    universities = sorted([str(u).strip() for u in MERGED_DATA['Home University'].dropna().unique().tolist() 
                           if str(u).strip() and str(u).strip().lower() not in ['nan', 'none']])
    
    branches = sorted([str(b).strip() for b in MERGED_DATA['Branch Name'].dropna().unique().tolist() 
                        if str(b).strip() and str(b).strip().lower() not in ['nan', 'none']])
    
    categories = ['Open', 'OBC', 'SC', 'ST', 'VJ', 'NT1', 'NT2', 'NT3', 'SEBC', 'EWS', 'TFWS', 'All India (AI / JEE)']
    cap_rounds = ["CAP Round 1", "CAP Round 2", "CAP Round 3", "CAP Round 4", "All Rounds"]

    return {
        "cities": cities,
        "universities": universities,
        "branches": branches,
        "categories": categories,
        "cap_rounds": cap_rounds
    }

def map_seat_categories(category: str, gender: str, home_uni_match: bool, is_pwd: bool, is_defense: bool, exam_type: str = "MHT-CET") -> List[str]:
    allowed_categories = []
    
    if category == "All India (AI / JEE)" or exam_type == "JEE-Main":
        allowed_categories.extend(JEE_AI_CATEGORIES)
        allowed_categories.extend(MHT_CET_AI_CATEGORIES)
        allowed_categories.extend(["GOPENS", "LOPENS", "GOPENH", "GOPENO", "LOPENH", "LOPENO"])
        return list(set(allowed_categories))

    cat_abbr = {
        "Open": "OPEN", "OBC": "OBC", "SC": "SC", "ST": "ST", "VJ": "VJ",
        "NT1": "NT1", "NT2": "NT2", "NT3": "NT3", "SEBC": "SEBC"
    }

    if category in ["EWS", "TFWS"]:
        allowed_categories.append(category)
        category = "Open"

    base_cat = cat_abbr.get(category, "OPEN")
    suffixes = ["S"]
    if home_uni_match:
        suffixes.append("H")
    else:
        suffixes.append("O")

    prefixes = ["G"]
    if gender == "Female":
        prefixes.append("L")

    for p in prefixes:
        for s in suffixes:
            allowed_categories.append(f"{p}{base_cat}{s}")
            if base_cat != "OPEN":
                allowed_categories.append(f"{p}OPEN{s}")

    if is_pwd:
        pwd_prefixes = ["PWD", "PWDR"]
        for pwd_pref in pwd_prefixes:
            for s in suffixes:
                allowed_categories.append(f"{pwd_pref}{base_cat}{s}")
                allowed_categories.append(f"{pwd_pref}OPEN{s}")
                allowed_categories.append(f"{pwd_pref}{base_cat}S")
                allowed_categories.append(f"{pwd_pref}OPENS")

    if is_defense:
        def_prefixes = ["DEF", "DEFR"]
        for def_pref in def_prefixes:
            for s in suffixes:
                allowed_categories.append(f"{def_pref}{base_cat}{s}")
                allowed_categories.append(f"{def_pref}OPEN{s}")
                allowed_categories.append(f"{def_pref}{base_cat}S")
                allowed_categories.append(f"{def_pref}OPENS")

    allowed_categories.extend(MHT_CET_AI_CATEGORIES)

    return list(set(allowed_categories))

@app.post("/api/predict")
def predict_colleges(req: PredictRequest):
    if MERGED_DATA.empty:
        load_data()
        if MERGED_DATA.empty:
            raise HTTPException(status_code=500, detail="Data is not loaded. Please verify Overall CSV files are present.")

    df = MERGED_DATA.copy()

    # Source CSV separation:
    # When JEE marks / All India selected -> use ONLY Overall_AI_CAP_Cutoff_2025-26.csv (Source_CSV == 'AI')
    # When PCM marks selected -> use ONLY Overall_MH_CAP_Cutoff_2025-26.csv (Source_CSV == 'MH')
    is_jee_exam = (req.exam_type == "JEE-Main" or req.category == "All India (AI / JEE)")
    if is_jee_exam:
        df = df[df['Source_CSV'] == "AI"]
    else:
        df = df[df['Source_CSV'] == "MH"]

    # CAP Round filter
    if req.cap_round and req.cap_round != "All Rounds":
        digits = "".join(filter(str.isdigit, req.cap_round))
        if digits:
            round_num = int(digits)
            df = df[df['CAP Round'] == round_num]

    # City filter (Case-insensitive & Alias Expanded)
    if req.preferred_cities and len(req.preferred_cities) > 0:
        expanded_cities = set()
        for c in req.preferred_cities:
            c_clean = str(c).strip().lower()
            expanded_cities.add(c_clean)
            if c in CITY_ALIASES:
                for alias in CITY_ALIASES[c]:
                    expanded_cities.add(alias.strip().lower())
            for main_city, aliases in CITY_ALIASES.items():
                if c_clean == main_city.lower() or c_clean in [a.lower() for a in aliases]:
                    expanded_cities.add(main_city.lower())
                    for a in aliases:
                        expanded_cities.add(a.lower())
                        
        df = df[df['City'].astype(str).str.strip().str.lower().isin(expanded_cities)]
        
    # Advanced Branch filter
    if req.preferred_branches and len(req.preferred_branches) > 0:
        def branch_matches(csv_branch):
            if pd.isna(csv_branch): return False
            csv_b = str(csv_branch).strip().lower()
            for pref in req.preferred_branches:
                pref_b = str(pref).strip().lower()
                if pref_b in csv_b or csv_b in pref_b:
                    return True
                pref_keywords = [w for w in pref_b.replace("&", " ").replace("-", " ").replace("(", " ").replace(")", " ").split() if len(w) > 2 and w not in ["engineering", "engg", "technology", "and"]]
                if pref_keywords and any(kw in csv_b for kw in pref_keywords):
                    return True
            return False
        df = df[df['Branch Name'].apply(branch_matches)]

    results = []
    user_uni_clean = str(req.home_university).strip().lower()
    
    for idx, row in df.iterrows():
        seat_cat = str(row['Seat Category'])
        
        if is_jee_exam:
            # For JEE Main / All India, all cutoffs in Overall_AI_CAP_Cutoff_2025-26.csv apply
            allowed_seat_cats = [seat_cat]
        else:
            college_uni = str(row['Home University']).strip()
            college_uni_clean = college_uni.lower()
            
            home_uni_match = (
                college_uni_clean == user_uni_clean or 
                user_uni_clean in college_uni_clean or
                college_uni_clean in user_uni_clean or
                any(auto_uni in college_uni_clean for auto_uni in [
                    "autonomous", 
                    "deemed", 
                    "dr. babasaheb ambedkar technological university", 
                    "sndt women"
                ])
            )
            
            allowed_seat_cats = map_seat_categories(
                category=req.category,
                gender=req.gender,
                home_uni_match=home_uni_match,
                is_pwd=req.is_pwd,
                is_defense=req.is_defense,
                exam_type=req.exam_type or "MHT-CET"
            )

        if seat_cat in allowed_seat_cats:
            cutoff = float(row['Closing Percentile'])
            diff = req.percentile - cutoff
            
            if diff >= 3.0:
                status = "Safe"
            elif diff >= -2.0:
                status = "Moderate"
            elif diff >= -15.0:
                status = "Dream"
            else:
                continue

            opening_cutoff = round(min(99.9999, cutoff + abs(cutoff * 0.025) + 1.25), 4)

            college_code_str = clean_int_code(row['College Code'])
            branch_code_str = clean_int_code(row['Branch Code'])
            if not branch_code_str:
                branch_code_str = college_code_str + "000"

            raw_type = str(row['Institute Type']).strip().lower() if not pd.isna(row['Institute Type']) else ""
            status_field = str(row['Status']).strip().lower() if not pd.isna(row['Status']) else ""
            is_auto = (status_field == "autonomous") or ("autonomous" in status_field and "non-autonomous" not in status_field)

            display_type = classify_institute_type(college_code_str, str(row['College Name']))

            cap_round_val = f"CAP Round {int(row['CAP Round'])}" if not pd.isna(row['CAP Round']) else "CAP Round 1"

            results.append({
                "college_code": college_code_str,
                "college_name": str(row['College Name']),
                "city": str(row['City']),
                "branch_name": str(row['Branch Name']),
                "branch_code": branch_code_str,
                "seat_category": seat_cat,
                "institute_type": display_type,
                "autonomy": "Autonomous" if is_auto else "Non-Autonomous",
                "university": str(row['University']) if not pd.isna(row['University']) and str(row['University']) != 'nan' else str(row['Home University']),
                "closing_cutoff": round(cutoff, 4),
                "opening_cutoff": opening_cutoff,
                "cutoff_rank": int(row['Closing Rank']) if not pd.isna(row['Closing Rank']) else None,
                "pdf_page_number": int(row['PDF Page Number']) if not pd.isna(row['PDF Page Number']) else None,
                "percentile_difference": round(diff, 4),
                "status": status,
                "cap_round": cap_round_val
            })

    city_priority = {city: i for i, city in enumerate(req.preferred_cities or [])}
    branch_priority = {branch: i for i, branch in enumerate(req.preferred_branches or [])}

    def get_city_idx(item):
        return city_priority.get(item['city'], 999)

    def get_branch_idx(item):
        for b, i in branch_priority.items():
            if b.lower() in item['branch_name'].lower():
                return i
        return 999

    sort_items = []
    if req.sort_by:
        if isinstance(req.sort_by, str):
            sort_items = [s.strip() for s in req.sort_by.split(",") if s.strip()]
        elif isinstance(req.sort_by, list):
            sort_items = req.sort_by

    default_order = ["cutoff", "city", "branch"]
    full_sort_order = []
    for s_item in sort_items:
        if s_item in default_order and s_item not in full_sort_order:
            full_sort_order.append(s_item)
    for d_item in default_order:
        if d_item not in full_sort_order:
            full_sort_order.append(d_item)

    def multi_sort_key(item):
        key = []
        for criteria in full_sort_order:
            if criteria == "cutoff":
                key.append(-item['closing_cutoff'])
            elif criteria == "city":
                key.append(get_city_idx(item))
            elif criteria == "branch":
                key.append(get_branch_idx(item))
        return tuple(key)

    results.sort(key=multi_sort_key)

    total_found = len(results)
    govt_count = sum(1 for r in results if "Government" in r['institute_type'] or "Aided" in r['institute_type'])
    private_count = total_found - govt_count
    autonomous_count = sum(1 for r in results if r['autonomy'] == "Autonomous")
    univ_depts_count = sum(1 for r in results if "University Department" in r['institute_type'])
    
    safe_count = sum(1 for r in results if r['status'] == "Safe")
    moderate_count = sum(1 for r in results if r['status'] == "Moderate")
    dream_count = sum(1 for r in results if r['status'] == "Dream")
    
    cutoffs = [r['closing_cutoff'] for r in results]
    avg_cutoff = round(sum(cutoffs)/total_found, 2) if total_found > 0 else 0.0
    highest_cutoff = round(max(cutoffs), 2) if total_found > 0 else 0.0
    lowest_cutoff = round(min(cutoffs), 2) if total_found > 0 else 0.0

    return {
        "metrics": {
            "colleges_found": total_found,
            "government": govt_count,
            "private": private_count,
            "autonomous": autonomous_count,
            "university_depts": univ_depts_count,
            "safe_option": safe_count,
            "moderate": moderate_count,
            "dream": dream_count,
            "avg_cutoff": avg_cutoff,
            "highest_cutoff": highest_cutoff,
            "lowest_cutoff": lowest_cutoff
        },
        "results": results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
