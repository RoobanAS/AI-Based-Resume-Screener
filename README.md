Problem Statement:

Recruiters often struggle with manually screening thousands of resumes, leading to inefficiencies, bias, and inconsistent candidate selection. The Automated Resume Screening System leverages AI and NLP to parse, analyze, and rank resumes based on job descriptions, ensuring a faster, unbiased, and more accurate hiring process. By using BERT embeddings and machine learning models, the system enhances candidate-job matching, reduces hiring time, and improves recruitment efficiency.


Approach for Automated Resume Screening System

Resume Parsing & Extraction:

Accepts resumes in PDF, DOCX, and image formats.
Uses PyPDF2, pdfplumber, docx2txt, and Tesseract OCR to extract text.
Identifies and structures key information like name, contact details, skills, education, and experience using spaCy-based NLP models.


Job Description Processing:

Accepts job descriptions as input via API.
Uses NLP techniques to extract required skills, qualifications, and experience.


Feature Extraction & Embeddings:

Converts both resumes and job descriptions into numerical vectors using BERT embeddings.
Applies TF-IDF, word embeddings, and contextual language models for feature representation.


Resume Matching & Ranking:

Computes the cosine similarity between resumes and job descriptions.
Uses machine learning models (scikit-learn, BERT) to rank resumes based on relevance.


Storage & Fast Retrieval:

Stores structured resume data in MongoDB.
Uses Elasticsearch for quick searches and filtering of resumes based on recruiter preferences.


Tools Used in Automated Resume Screening System

1️ Programming & Development
Python – Main programming language
Flask / FastAPI – Backend API development

2️ Natural Language Processing (NLP)
spaCy – Named Entity Recognition (NER) for extracting details
BERT (Bidirectional Encoder Representations from Transformers) – Resume and job description similarity matching
scikit-learn – Machine learning models for ranking resumes
TF-IDF / Word Embeddings – Feature extraction

3️ Resume & Job Description Parsing
PyPDF2 / pdfplumber – Extract text from PDFs
docx2txt – Extract text from DOCX files
Tesseract OCR – Extract text from images (scanned resumes)

4️ Data Storage & Search
PostgreSQL / MongoDB – Database for storing resumes and job descriptions
Elasticsearch – Fast search and retrieval of resumes

5️ Deployment & Version Control
Docker – Containerization for easy deployment
GitHub / GitLab – Version control for managing project updates
Postman – API testing and validation
