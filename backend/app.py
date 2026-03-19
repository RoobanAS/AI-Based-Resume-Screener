from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import os
import json
import math
from werkzeug.utils import secure_filename

# Try pdfplumber first, fall back to PyPDF2
try:
    import pdfplumber
    PDF_PARSER = "pdfplumber"
except ImportError:
    try:
        import PyPDF2
        PDF_PARSER = "pypdf2"
    except ImportError:
        PDF_PARSER = None

import spacy
from textblob import TextBlob
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
import numpy as np

app = Flask(__name__)
CORS(app)

nlp = spacy.load("en_core_web_lg")

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# ─────────────────────────────────────────────
#  SKILL TAXONOMY (expanded)
# ─────────────────────────────────────────────
SKILL_CATEGORIES = {
    "programming": ['javascript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'typescript', 'r', 'matlab'],
    "web": ['html', 'css', 'react', 'angular', 'vue', 'node', 'django', 'flask', 'fastapi', 'graphql', 'rest', 'webpack', 'tailwind', 'nextjs', 'nuxt'],
    "data": ['sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'data', 'analysis', 'pandas', 'numpy', 'matplotlib', 'tableau', 'powerbi', 'spark'],
    "ml_ai": ['machine learning', 'deep learning', 'nlp', 'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'opencv', 'transformers', 'llm', 'huggingface'],
    "devops": ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd', 'ansible', 'linux', 'bash', 'git', 'github', 'devops'],
    "soft": ['agile', 'scrum', 'kanban', 'leadership', 'management', 'communication', 'teamwork', 'problem solving', 'critical thinking', 'mentoring'],
    "security": ['cybersecurity', 'penetration testing', 'owasp', 'soc', 'siem', 'firewall', 'encryption', 'compliance', 'iso 27001'],
    "design": ['figma', 'sketch', 'adobe xd', 'ui/ux', 'wireframing', 'prototyping', 'user research', 'accessibility'],
}
COMMON_SKILLS = set(skill for skills in SKILL_CATEGORIES.values() for skill in skills)

SKILL_RESOURCES = {
    "python": "Python on Codecademy → https://codecademy.com/learn/learn-python-3",
    "aws": "AWS Cert on Coursera → https://coursera.org/professional-certificates/aws-cloud-technology-consultant",
    "sql": "SQL on Khan Academy → https://khanacademy.org/computing/computer-programming/sql",
    "javascript": "JS on freeCodeCamp → https://freecodecamp.org/learn/javascript-algorithms-and-data-structures/",
    "java": "Java on Udemy → https://udemy.com/course/java-the-complete-java-developer-course/",
    "react": "React Docs → https://react.dev/learn",
    "docker": "Docker Mastery → https://udemy.com/course/docker-mastery/",
    "git": "Git on freeCodeCamp → https://youtube.com/watch?v=RGOj5yH7evk",
    "machine learning": "ML on Coursera → https://coursera.org/specializations/machine-learning-introduction",
    "tensorflow": "TF Dev Cert → https://coursera.org/professional-certificates/tensorflow-in-practice",
    "kubernetes": "K8s on Linux Foundation → https://training.linuxfoundation.org/training/introduction-to-kubernetes/",
    "typescript": "TS on Udemy → https://udemy.com/course/learn-typescript/",
    "agile": "Agile on LinkedIn → https://linkedin.com/learning/agile-foundations",
    "leadership": "Leadership on edX → https://edx.org/course/leadership-and-influence",
    "data": "Data Analysis on Coursera → https://coursera.org/learn/data-analysis-python",
}

EDUCATION_KEYWORDS = {
    "phd": 5, "doctorate": 5, "ph.d": 5,
    "master": 4, "m.s.": 4, "mba": 4, "m.e.": 4,
    "bachelor": 3, "b.s.": 3, "b.e.": 3, "b.tech": 3, "undergraduate": 3,
    "associate": 2, "diploma": 2,
    "certification": 1, "certificate": 1, "bootcamp": 1,
}

CERT_KEYWORDS = [
    'aws certified', 'google certified', 'azure certified', 'pmp', 'cissp', 'ceh',
    'scrum master', 'safe', 'togaf', 'itil', 'cpa', 'cfa', 'six sigma',
    'tensorflow developer', 'kubernetes administrator', 'terraform associate'
]

# ─────────────────────────────────────────────
#  ML MODEL (improved training data)
# ─────────────────────────────────────────────
X_train = np.array([
    [90, 7, 15, 5, 2], [85, 5, 12, 4, 1], [60, 2, 5, 2, 0],
    [75, 4, 8, 3, 1],  [95, 8, 16, 5, 3], [50, 1, 3, 1, 0],
    [30, 0, 2, 0, 0],  [80, 3, 10, 3, 1], [55, 2, 4, 2, 0],
    [70, 3, 7, 3, 0],  [40, 1, 3, 1, 0],  [65, 2, 6, 2, 1],
    [88, 6, 13, 4, 2], [45, 1, 4, 1, 0],  [92, 7, 14, 5, 2],
])
y_train = np.array([1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1])

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_train)
job_fit_model = LogisticRegression(C=1.0, max_iter=500).fit(X_scaled, y_train)


# ─────────────────────────────────────────────
#  TEXT EXTRACTION
# ─────────────────────────────────────────────
def extract_text_from_pdf(filepath):
    text = ""
    if PDF_PARSER == "pdfplumber":
        try:
            import pdfplumber
            with pdfplumber.open(filepath) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        text += t + "\n"
            return text.strip()
        except Exception as e:
            print(f"pdfplumber error: {e}")
    if PDF_PARSER == "pypdf2" or not text:
        try:
            import PyPDF2
            with open(filepath, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += (page.extract_text() or "") + "\n"
            return text.strip()
        except Exception as e:
            print(f"PyPDF2 error: {e}")
    return text

def extract_text_from_txt(filepath):
    encodings = ['utf-8', 'latin-1', 'cp1252']
    for enc in encodings:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                return f.read().strip()
        except (UnicodeDecodeError, Exception):
            continue
    return ""


# ─────────────────────────────────────────────
#  NLP HELPERS
# ─────────────────────────────────────────────
def extract_candidate_name(text):
    """Extract likely name from the first 5 lines of resume."""
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()][:8]
    for line in lines:
        doc = nlp(line)
        for ent in doc.ents:
            if ent.label_ == "PERSON" and 2 <= len(ent.text.split()) <= 4:
                return ent.text.title()
    # Fallback: first line that looks like a name
    if lines:
        first = lines[0]
        if len(first.split()) in [2, 3] and first[0].isupper():
            return first.title()
    return None

def extract_key_skills(text):
    text_lower = text.lower()
    found = set()
    # Multi-word first
    for skill in sorted(COMMON_SKILLS, key=len, reverse=True):
        if skill in text_lower:
            found.add(skill)
    # spaCy token match
    doc = nlp(text_lower[:5000])
    for token in doc:
        if token.text in COMMON_SKILLS and not token.is_stop:
            found.add(token.text)
    return list(found)

def extract_skill_categories(skills):
    result = {}
    for cat, cat_skills in SKILL_CATEGORIES.items():
        matched = [s for s in skills if s in cat_skills]
        if matched:
            result[cat] = matched
    return result

def extract_education(text):
    text_lower = text.lower()
    best_level = 0
    best_label = "Not specified"
    for kw, level in EDUCATION_KEYWORDS.items():
        if kw in text_lower and level > best_level:
            best_level = level
            best_label = kw.upper()
    return best_label, best_level

def extract_certifications(text):
    text_lower = text.lower()
    found = []
    for cert in CERT_KEYWORDS:
        if cert in text_lower:
            found.append(cert.title())
    return found

def extract_contact_info(text):
    email = re.search(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}', text)
    phone = re.search(r'(\+?\d[\d\s\-().]{8,}\d)', text)
    linkedin = re.search(r'linkedin\.com/in/[\w\-]+', text, re.IGNORECASE)
    github = re.search(r'github\.com/[\w\-]+', text, re.IGNORECASE)
    return {
        "email": email.group(0) if email else None,
        "phone": phone.group(0).strip() if phone else None,
        "linkedin": linkedin.group(0) if linkedin else None,
        "github": github.group(0) if github else None,
    }

def extract_experience_years(text):
    patterns = [
        r'(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)',
        r'experience\s+of\s+(\d+)\+?\s*(?:years?|yrs?)',
        r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:in|of|working)',
    ]
    years = []
    for p in patterns:
        for m in re.finditer(p, text, re.IGNORECASE):
            val = int(m.group(1))
            if 0 < val <= 50:
                years.append(val)
    return max(years) if years else 0

def summarize_resume(resume_text):
    doc = nlp(resume_text[:3000])
    sentences = [sent.text.strip() for sent in doc.sents if 15 < len(sent.text.strip()) < 250]
    if not sentences:
        return resume_text[:200] + "..."
    scored = []
    for sent in sentences:
        skills = extract_key_skills(sent)
        words = len(sent.split())
        score = len(skills) * 2 + min(words / 30, 2)
        scored.append((sent, score))
    top = sorted(scored, key=lambda x: x[1], reverse=True)[:2]
    return " ".join(s for s, _ in top)

def analyze_sentiment(text):
    blob = TextBlob(text[:2000])
    p = blob.sentiment.polarity
    if p > 0.25:
        return "Confident"
    elif p > 0.05:
        return "Positive"
    elif p < -0.1:
        return "Passive"
    else:
        return "Neutral"

def predict_job_fit(similarity, experience, keywords, edu_level, certs):
    features = np.array([[similarity, experience, keywords, edu_level, certs]])
    features_scaled = scaler.transform(features)
    prob = job_fit_model.predict_proba(features_scaled)[0][1]
    # Blend with rule-based
    rule_score = (similarity * 0.4 + min(experience / 10, 1) * 20 + min(keywords / 15, 1) * 20 + edu_level * 4 + min(certs * 5, 15))
    blended = (prob * 60 + rule_score * 0.4)
    return min(round(blended), 100)


# ─────────────────────────────────────────────
#  SCORING ENGINE
# ─────────────────────────────────────────────
def calculate_scores(job_desc, resume_text):
    # Semantic similarity
    job_doc = nlp(job_desc[:5000])
    resume_doc = nlp(resume_text[:5000])
    similarity_score = min(round(job_doc.similarity(resume_doc) * 100), 100)

    # Skill matching
    job_skills = set(extract_key_skills(job_desc))
    resume_skills = set(extract_key_skills(resume_text))
    matched_keywords = job_skills & resume_skills
    keyword_coverage = (len(matched_keywords) / len(job_skills) * 100) if job_skills else 0

    # Experience
    required_years = extract_experience_years(job_desc)
    candidate_years = extract_experience_years(resume_text)
    exp_score = 100 if required_years == 0 else min((candidate_years / max(required_years, 1)) * 100, 100)

    # Education
    _, edu_level = extract_education(resume_text)

    # Certifications
    certs = extract_certifications(resume_text)

    # Resume completeness
    contact = extract_contact_info(resume_text)
    completeness = sum([
        bool(contact["email"]) * 20,
        bool(contact["phone"]) * 10,
        bool(contact["linkedin"]) * 10,
        bool(contact["github"]) * 10,
        min(len(resume_text.split()) / 300 * 30, 30),
        min(edu_level * 4, 20),
    ])

    # ATS Score (weighted composite)
    ats_score = (
        keyword_coverage * 0.40 +
        exp_score * 0.25 +
        similarity_score * 0.20 +
        completeness * 0.15
    )

    return {
        "similarityScore": similarity_score,
        "atsScore": round(min(ats_score, 100)),
        "keywordCoverage": round(keyword_coverage),
        "matchedKeywords": sorted(matched_keywords),
        "missingKeywords": sorted(job_skills - resume_skills),
        "experienceYears": candidate_years,
        "requiredYears": required_years,
        "educationLevel": extract_education(resume_text)[0],
        "educationScore": edu_level,
        "certifications": certs,
        "contactInfo": contact,
        "completenessScore": round(completeness),
        "skillCategories": extract_skill_categories(list(resume_skills)),
    }


# ─────────────────────────────────────────────
#  FEEDBACK ENGINE
# ─────────────────────────────────────────────
def generate_feedback(job_desc, resume_text, scores):
    missing = [s for s in scores["missingKeywords"] if s in SKILL_RESOURCES][:4]
    unique = [s for s in set(extract_key_skills(resume_text)) - set(extract_key_skills(job_desc))][:3]

    strengths, weaknesses, suggestions, skill_gaps = [], [], [], []

    # Strengths
    if scores["matchedKeywords"]:
        top = ", ".join(list(scores["matchedKeywords"])[:3])
        strengths.append(f"Strong keyword alignment: {top}.")
    if scores["experienceYears"] >= scores["requiredYears"] > 0:
        strengths.append(f"Experience ({scores['experienceYears']} yrs) meets or exceeds the {scores['requiredYears']}-yr requirement.")
    elif scores["experienceYears"] > 3:
        strengths.append(f"{scores['experienceYears']} years of experience adds strong credibility.")
    if scores["certifications"]:
        strengths.append(f"Certifications found: {', '.join(scores['certifications'][:2])}.")
    if unique:
        strengths.append(f"Differentiating skills: {', '.join(unique[:2])} stand out.")
    if scores["contactInfo"]["linkedin"]:
        strengths.append("LinkedIn profile present — improves ATS visibility.")

    # Weaknesses
    if missing:
        weaknesses.append(f"Missing critical job skills: {', '.join(missing[:3])}.")
    if scores["requiredYears"] > 0 and scores["experienceYears"] < scores["requiredYears"]:
        gap = scores["requiredYears"] - scores["experienceYears"]
        weaknesses.append(f"Experience gap: {gap} year(s) short of the {scores['requiredYears']}-yr requirement.")
    if scores["completenessScore"] < 50:
        weaknesses.append(f"Resume completeness is low ({scores['completenessScore']}%). Add contact details and more content.")
    if not scores["contactInfo"]["email"]:
        weaknesses.append("No email address detected — critical for ATS parsing.")
    if len(resume_text.split()) < 100:
        weaknesses.append(f"Resume is very short ({len(resume_text.split())} words). Expand with projects and achievements.")

    # Suggestions
    if missing:
        suggestions.append(f"Incorporate '{missing[0]}' prominently in your skills section.")
    if scores["experienceYears"] > 0:
        suggestions.append(f"Quantify achievements from your {scores['experienceYears']} years — use numbers and impact metrics.")
    if not scores["certifications"]:
        suggestions.append("Add relevant certifications to significantly boost ATS score.")
    if not scores["contactInfo"]["github"]:
        suggestions.append("Add a GitHub profile link — especially important for technical roles.")
    if unique:
        suggestions.append(f"Contextualise '{unique[0]}' within the job requirements for greater relevance.")

    # Skill Gaps
    for skill in missing:
        if skill in SKILL_RESOURCES:
            skill_gaps.append(f"'{skill.title()}': {SKILL_RESOURCES[skill]}")

    return {
        "strengths": strengths or ["Resume shows relevant content — refine keyword alignment."],
        "weaknesses": weaknesses or ["Minor gaps; consider adding more specific technical details."],
        "suggestions": suggestions or ["Tailor the resume more specifically to this job description."],
        "skillGaps": skill_gaps or ["No critical skill gaps identified based on common skills."]
    }


# ─────────────────────────────────────────────
#  ROUTE
# ─────────────────────────────────────────────
@app.route("/screen", methods=["POST"])
def screen_resumes():
    if "jobDescription" not in request.form:
        return jsonify({"error": "Job description is required"}), 400
    if "resumes" not in request.files:
        return jsonify({"error": "No resumes uploaded"}), 400

    job_desc = request.form["jobDescription"]
    files = request.files.getlist("resumes")
    candidates = []

    for file in files:
        filename = secure_filename(file.filename)
        if not filename.lower().endswith((".txt", ".pdf")):
            continue

        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        text = extract_text_from_pdf(filepath) if filename.lower().endswith(".pdf") else extract_text_from_txt(filepath)

        if not text or not text.strip():
            continue

        scores = calculate_scores(job_desc, text)
        feedback = generate_feedback(job_desc, text, scores)
        summary = summarize_resume(text)
        tone = analyze_sentiment(text)
        job_fit = predict_job_fit(
            scores["similarityScore"],
            scores["experienceYears"],
            len(scores["matchedKeywords"]),
            scores["educationScore"],
            len(scores["certifications"])
        )

        # Extract name from resume content; fall back to filename
        candidate_name = extract_candidate_name(text) or os.path.splitext(filename)[0].replace("_", " ").replace("-", " ").title()

        overall_score = round(
            scores["atsScore"] * 0.40 +
            scores["similarityScore"] * 0.30 +
            job_fit * 0.30
        )

        candidates.append({
            "name": candidate_name,
            "filename": filename,
            "overallScore": overall_score,
            "similarityScore": scores["similarityScore"],
            "atsScore": scores["atsScore"],
            "jobFit": job_fit,
            "keywordCoverage": scores["keywordCoverage"],
            "matchedKeywords": scores["matchedKeywords"],
            "missingKeywords": scores["missingKeywords"][:8],
            "experienceYears": scores["experienceYears"],
            "requiredYears": scores["requiredYears"],
            "educationLevel": scores["educationLevel"],
            "certifications": scores["certifications"],
            "contactInfo": scores["contactInfo"],
            "completenessScore": scores["completenessScore"],
            "skillCategories": scores["skillCategories"],
            "feedback": feedback,
            "summary": summary,
            "tone": tone,
        })

    if not candidates:
        return jsonify({"error": "No readable resumes found. Check file format (PDF/TXT)."}), 400

    candidates.sort(key=lambda x: (x["overallScore"], x["atsScore"], x["similarityScore"]), reverse=True)
    return jsonify({"candidates": candidates})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "pdf_parser": PDF_PARSER, "spacy_model": "en_core_web_lg"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
