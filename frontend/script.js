/* ─────────────────────────────────────────────
   RecruitIQ — script.js
───────────────────────────────────────────── */

// ─── DOM References ───────────────────────────
const $jd          = document.getElementById("jobDescription");
const $charCount   = document.getElementById("charCount");
const $wordCount   = document.getElementById("wordCount");
const $keySkills   = document.getElementById("keySkills");
const $keyPanel    = document.getElementById("keySkillsPanel");
const $skillDist   = document.getElementById("skillDistChart");
const $skillBars   = document.getElementById("skillDistBars");
const $dropzone    = document.getElementById("dropzone");
const $resumeFiles = document.getElementById("resumeFiles");
const $fileList    = document.getElementById("fileList");
const $resumeMeta  = document.getElementById("resumeMeta");
const $resumeCount = document.getElementById("resumeCount");
const $screenBtn   = document.getElementById("screenBtn");
const $loading     = document.getElementById("loadingState");
const $loadFill    = document.getElementById("loadingFill");
const $loadLabel   = document.getElementById("loadingLabel");
const $emptyState  = document.getElementById("emptyState");
const $resultsHdr  = document.getElementById("resultsHeader");
const $summaryBar  = document.getElementById("summaryBar");
const $candList    = document.getElementById("candidateList");
const $modal       = document.getElementById("detailModal");
const $modalContent= document.getElementById("modalContent");
const $sortSelect  = document.getElementById("sortSelect");

// ─── State ────────────────────────────────────
let allCandidates = [];
let activeTab = {};   // keyed by candidate index

// ─── Skill Taxonomy (mirrors backend) ─────────
const SKILL_CATEGORIES = {
    programming: ['javascript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'typescript', 'r', 'matlab'],
    web:         ['html', 'css', 'react', 'angular', 'vue', 'node', 'django', 'flask', 'fastapi', 'graphql', 'rest', 'webpack', 'tailwind', 'nextjs', 'nuxt'],
    data:        ['sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'data', 'analysis', 'pandas', 'numpy', 'matplotlib', 'tableau', 'powerbi', 'spark'],
    ml_ai:       ['machine learning', 'deep learning', 'nlp', 'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'opencv', 'transformers', 'llm', 'huggingface'],
    devops:      ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd', 'ansible', 'linux', 'bash', 'git', 'github', 'devops'],
    soft:        ['agile', 'scrum', 'kanban', 'leadership', 'management', 'communication', 'teamwork', 'problem solving', 'critical thinking', 'mentoring'],
};
const ALL_SKILLS = [...new Set(Object.values(SKILL_CATEGORIES).flat())];
const STOP_WORDS  = new Set(['a','an','and','are','as','at','be','by','for','from','has','he','in','is','it','its','of','on','that','the','to','was','were','will','with','we','you','your','our','their','this','these','those','can','should','must','have','had','not','but','or','also','both','each','more','other','some','such','than','then','they','there','use','used','using','work','works','working']);

// ─── Job Description Analysis ─────────────────
$jd.addEventListener("input", () => {
    const val = $jd.value;
    $charCount.textContent = `${val.length} / 2000`;
    $wordCount.textContent = `${val.trim() ? val.trim().split(/\s+/).length : 0} words`;
    updateKeySkills(val);
});

function extractSkills(text) {
    const lower = text.toLowerCase();
    const found = {};
    for (const [cat, skills] of Object.entries(SKILL_CATEGORIES)) {
        for (const skill of skills) {
            if (lower.includes(skill)) {
                if (!found[cat]) found[cat] = [];
                if (!found[cat].includes(skill)) found[cat].push(skill);
            }
        }
    }
    return found;
}

function updateKeySkills(text) {
    const categorised = extractSkills(text);
    const allFound = Object.values(categorised).flat();
    if (allFound.length === 0) {
        $keyPanel.style.display = "none";
        $skillDist.style.display = "none";
        return;
    }
    $keyPanel.style.display = "block";
    $keySkills.innerHTML = allFound.map(skill => {
        const cat = Object.keys(categorised).find(c => categorised[c].includes(skill)) || "default";
        return `<span class="skill-tag cat-${cat}">${skill}</span>`;
    }).join("");

    // Skill distribution bars
    const catColors = { programming: "#60a5fa", web: "#a78bfa", data: "#10b981", ml_ai: "#f59e0b", devops: "#f87171", soft: "#9ca3af" };
    const maxCat = Math.max(...Object.values(categorised).map(s => s.length));
    $skillBars.innerHTML = Object.entries(categorised)
        .filter(([,s]) => s.length > 0)
        .map(([cat, skills]) => `
            <div class="skill-dist-bar-row">
                <div class="skill-dist-label">${cat}</div>
                <div class="skill-dist-track">
                    <div class="skill-dist-fill" style="width:${(skills.length/maxCat)*100}%; background:${catColors[cat]||'#888'}"></div>
                </div>
                <div class="skill-dist-count">${skills.length}</div>
            </div>
        `).join("");
    $skillDist.style.display = "block";
}

// ─── Drag & Drop ──────────────────────────────
$dropzone.addEventListener("dragover", e => { e.preventDefault(); $dropzone.classList.add("drag-over"); });
$dropzone.addEventListener("dragleave", () => $dropzone.classList.remove("drag-over"));
$dropzone.addEventListener("drop", e => {
    e.preventDefault();
    $dropzone.classList.remove("drag-over");
    $resumeFiles.files = e.dataTransfer.files;
    handleFileSelect($resumeFiles.files);
});
$resumeFiles.addEventListener("change", () => handleFileSelect($resumeFiles.files));

function handleFileSelect(files) {
    const valid = Array.from(files).filter(f => /\.(pdf|txt)$/i.test(f.name));
    $fileList.innerHTML = "";
    if (valid.length === 0) {
        $dropzone.classList.remove("has-files");
        $resumeMeta.style.display = "none";
        return;
    }
    $dropzone.classList.add("has-files");
    valid.forEach(file => {
        const item = document.createElement("div");
        item.className = "file-item";
        const sizeStr = file.size > 1024*1024 ? `${(file.size/1024/1024).toFixed(1)} MB` : `${Math.round(file.size/1024)} KB`;
        const icon = file.name.endsWith(".pdf") ? "📕" : "📄";
        item.innerHTML = `
            <span class="file-item-icon">${icon}</span>
            <span class="file-item-name">${file.name}</span>
            <span class="file-item-size">${sizeStr}</span>
        `;
        $fileList.appendChild(item);
    });
    $resumeMeta.style.display = "block";
    $resumeCount.textContent = `${valid.length} file${valid.length !== 1 ? "s" : ""}`;
}

// ─── Screen Resumes ───────────────────────────
const LOADING_STEPS = [
    "Initialising NLP engine…",
    "Parsing resume documents…",
    "Running semantic analysis…",
    "Scoring ATS compatibility…",
    "Calculating job fit…",
    "Ranking candidates…",
    "Finalising results…"
];

async function screenResumes() {
    const jd = $jd.value.trim();
    if (!jd) { showAlert("Please enter a job description."); return; }
    const files = $resumeFiles.files;
    if (!files || files.length === 0) { showAlert("Please upload at least one resume."); return; }

    $screenBtn.disabled = true;
    $loading.style.display = "block";
    $emptyState.style.display = "none";
    $resultsHdr.style.display = "none";
    $summaryBar.style.display = "none";
    $candList.innerHTML = "";

    // Animate loading
    let step = 0;
    const stepInterval = setInterval(() => {
        if (step < LOADING_STEPS.length) {
            $loadLabel.textContent = LOADING_STEPS[step];
            $loadFill.style.width = `${((step + 1) / LOADING_STEPS.length) * 90}%`;
            step++;
        }
    }, 600);

    const formData = new FormData();
    formData.append("jobDescription", jd);
    Array.from(files).forEach(f => formData.append("resumes", f));

    try {
        const res = await fetch("http://localhost:5000/screen", { method: "POST", body: formData });
        const data = await res.json();

        clearInterval(stepInterval);
        $loadFill.style.width = "100%";
        $loadLabel.textContent = "Done!";

        await sleep(400);
        $loading.style.display = "none";

        if (data.error) {
            showAlert(data.error);
            return;
        }

        allCandidates = data.candidates;
        renderCandidates(allCandidates);
    } catch (err) {
        clearInterval(stepInterval);
        $loading.style.display = "none";
        showAlert("❌ Could not connect to backend. Is the Flask server running on port 5000?");
        console.error(err);
    } finally {
        $screenBtn.disabled = false;
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Render Candidates ────────────────────────
function renderCandidates(candidates) {
    $candList.innerHTML = "";

    if (!candidates.length) {
        $emptyState.style.display = "flex";
        return;
    }

    $emptyState.style.display = "none";
    $resultsHdr.style.display = "flex";
    $summaryBar.style.display = "grid";

    // Summary bar
    const avgATS = Math.round(candidates.reduce((s, c) => s + c.atsScore, 0) / candidates.length);
    const topFit = Math.max(...candidates.map(c => c.jobFit));
    const avgExp = (candidates.reduce((s, c) => s + c.experienceYears, 0) / candidates.length).toFixed(1);
    document.getElementById("statTotal").innerHTML  = `<div class="stat-val">${candidates.length}</div><div class="stat-label">Candidates</div>`;
    document.getElementById("statAvgATS").innerHTML = `<div class="stat-val">${avgATS}%</div><div class="stat-label">Avg ATS</div>`;
    document.getElementById("statTopFit").innerHTML = `<div class="stat-val">${topFit}%</div><div class="stat-label">Top Fit</div>`;
    document.getElementById("statAvgExp").innerHTML = `<div class="stat-val">${avgExp}</div><div class="stat-label">Avg Exp (yrs)</div>`;

    candidates.forEach((c, i) => {
        const li = document.createElement("li");
        li.className = `candidate-item rank-${i < 3 ? i + 1 : 'other'}`;
        li.style.animationDelay = `${i * 60}ms`;

        const overallColor = scoreColor(c.overallScore);
        const circumference = 2 * Math.PI * 22;
        const dashOffset = circumference * (1 - c.overallScore / 100);

        // Top keywords
        const topMatched = (c.matchedKeywords || []).slice(0, 5);
        const topMissing = (c.missingKeywords || []).slice(0, 3);
        const kwHTML = [
            ...topMatched.map(k => `<span class="kw-tag matched">${k}</span>`),
            ...topMissing.map(k => `<span class="kw-tag missing">−${k}</span>`)
        ].join("");

        li.innerHTML = `
            <div class="candidate-header">
                <div class="candidate-rank">${String(i + 1).padStart(2, '0')}</div>
                <div class="candidate-info">
                    <div class="candidate-name">${escHtml(c.name)}</div>
                    <div class="candidate-meta">
                        <span class="meta-tag">${c.experienceYears > 0 ? `${c.experienceYears} yrs exp` : "Exp not stated"}</span>
                        <span class="meta-sep">·</span>
                        <span class="meta-tag">${c.educationLevel || "Edu N/A"}</span>
                        ${c.certifications && c.certifications.length ? `<span class="meta-sep">·</span><span class="meta-tag">🏅 ${c.certifications.length} cert${c.certifications.length > 1 ? "s" : ""}</span>` : ""}
                        <span class="meta-sep">·</span>
                        <span class="meta-tag" style="color:var(--${c.tone==='Confident'?'green':c.tone==='Passive'?'red':'blue'})">${c.tone}</span>
                    </div>
                </div>
                <div class="score-ring-wrap">
                    <div class="score-ring">
                        <svg width="54" height="54" viewBox="0 0 54 54">
                            <circle class="score-ring-bg" cx="27" cy="27" r="22"/>
                            <circle class="score-ring-fill" cx="27" cy="27" r="22"
                                stroke="${overallColor}"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${dashOffset}"/>
                        </svg>
                        <div class="score-ring-val">${c.overallScore}%</div>
                    </div>
                    <div class="score-ring-label">Overall</div>
                </div>
            </div>
            <div class="score-chips">
                <div class="chip green"><span class="chip-label">ATS</span><span class="chip-val">${c.atsScore}%</span></div>
                <div class="chip blue"><span class="chip-label">Similarity</span><span class="chip-val">${c.similarityScore}%</span></div>
                <div class="chip amber"><span class="chip-label">Job Fit</span><span class="chip-val">${c.jobFit}%</span></div>
                <div class="chip purple"><span class="chip-label">Keywords</span><span class="chip-val">${c.matchedKeywords ? c.matchedKeywords.length : 0}</span></div>
                <div class="chip ${c.completenessScore >= 60 ? 'green' : 'red'}"><span class="chip-label">Complete</span><span class="chip-val">${c.completenessScore}%</span></div>
            </div>
            ${kwHTML ? `<div class="candidate-keywords">${kwHTML}</div>` : ""}
            <button class="detail-btn" onclick="openModal(${i})">View full analysis →</button>
        `;
        $candList.appendChild(li);
    });
}

function scoreColor(score) {
    if (score >= 75) return "var(--green)";
    if (score >= 50) return "var(--amber)";
    return "var(--red)";
}

// ─── Sort ─────────────────────────────────────
function sortCandidates() {
    const key = $sortSelect.value;
    const sorted = [...allCandidates].sort((a, b) => {
        const map = { overall: "overallScore", ats: "atsScore", similarity: "similarityScore", fit: "jobFit", experience: "experienceYears" };
        return (b[map[key]] || 0) - (a[map[key]] || 0);
    });
    renderCandidates(sorted);
}

// ─── Modal ────────────────────────────────────
function openModal(idx) {
    const c = allCandidates[idx];
    if (!c) return;
    if (!activeTab[idx]) activeTab[idx] = "overview";

    $modalContent.innerHTML = buildModalHTML(c, idx);
    $modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    // Activate stored tab
    switchTab(idx, activeTab[idx], false);
}

function closeModal() {
    $modal.style.display = "none";
    document.body.style.overflow = "";
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

function switchTab(idx, tab, store = true) {
    if (store) activeTab[idx] = tab;
    const panels = document.querySelectorAll(".modal-tab-panel");
    const tabs   = document.querySelectorAll(".modal-tab");
    panels.forEach(p => p.classList.toggle("active", p.dataset.tab === tab));
    tabs.forEach(t   => t.classList.toggle("active", t.dataset.tab === tab));
}

function buildModalHTML(c, idx) {
    const tabs = ["overview", "skills", "feedback", "contact"];
    const tabLabels = { overview: "Overview", skills: "Skills", feedback: "Feedback", contact: "Profile" };

    const tabsHTML = tabs.map(t => `<button class="modal-tab" data-tab="${t}" onclick="switchTab(${idx}, '${t}')">${tabLabels[t]}</button>`).join("");

    // Overview tab
    const overviewHTML = `
        <div class="resume-summary-box">${escHtml(c.summary || "No summary available.")}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
            ${infoCard("🎓 Education", c.educationLevel || "Not specified")}
            ${infoCard("📅 Experience", c.experienceYears > 0 ? `${c.experienceYears} years` : "Not specified")}
            ${infoCard("🗣 Resume Tone", c.tone || "Neutral")}
            ${infoCard("🏅 Certifications", c.certifications && c.certifications.length ? c.certifications.slice(0, 2).join(", ") : "None detected")}
        </div>
        ${c.matchedKeywords && c.matchedKeywords.length ? `
            <div class="skills-panel-title" style="margin-bottom:8px;">Matched Keywords (${c.matchedKeywords.length})</div>
            <div class="skill-tags" style="margin-bottom:14px;">${c.matchedKeywords.map(k => `<span class="skill-tag cat-data">${k}</span>`).join("")}</div>
        ` : ""}
        ${c.missingKeywords && c.missingKeywords.length ? `
            <div class="skills-panel-title" style="margin-bottom:8px;">Missing Keywords</div>
            <div class="skill-tags">${c.missingKeywords.slice(0, 8).map(k => `<span class="skill-tag" style="background:rgba(248,113,113,0.08);border-color:#7f1d1d;color:#f87171;">${k}</span>`).join("")}</div>
        ` : ""}
    `;

    // Skills tab
    const cats = c.skillCategories || {};
    const skillsHTML = Object.keys(cats).length
        ? `<div class="modal-skill-grid">${Object.entries(cats).map(([cat, skills]) => `
            <div class="skill-cat-row">
                <div class="skill-cat-name">${cat}</div>
                <div class="skill-cat-tags">${skills.map(s => `<span class="skill-tag cat-${cat}">${s}</span>`).join("")}</div>
            </div>`).join("")}</div>`
        : `<div style="color:var(--text-muted);font-size:0.85rem;">No structured skill categories detected.</div>`;

    // Feedback tab
    const fb = c.feedback || {};
    const feedbackHTML = `
        ${feedbackSection("Strengths",  fb.strengths,   "strengths")}
        ${feedbackSection("Weaknesses", fb.weaknesses,  "weaknesses")}
        ${feedbackSection("Suggestions",fb.suggestions, "suggestions")}
        ${feedbackSection("Skill Gaps & Resources", fb.skillGaps, "gaps")}
    `;

    // Contact tab
    const ci = c.contactInfo || {};
    const contactHTML = `
        <div class="contact-grid" style="margin-bottom:16px;">
            ${contactCard("📧", "Email",    ci.email)}
            ${contactCard("📱", "Phone",    ci.phone)}
            ${contactCard("🔗", "LinkedIn", ci.linkedin)}
            ${contactCard("🐙", "GitHub",   ci.github)}
        </div>
        <div style="margin-top:8px;">
            ${infoCard("📄 File", c.filename || c.name, "100%")}
        </div>
    `;

    const panelsHTML = [
        `<div class="modal-tab-panel" data-tab="overview">${overviewHTML}</div>`,
        `<div class="modal-tab-panel" data-tab="skills">${skillsHTML}</div>`,
        `<div class="modal-tab-panel" data-tab="feedback">${feedbackHTML}</div>`,
        `<div class="modal-tab-panel" data-tab="contact">${contactHTML}</div>`,
    ].join("");

    const circumference = 2 * Math.PI * 22;
    const scoreRow = [
        { label: "Overall", val: c.overallScore, color: scoreColor(c.overallScore) },
        { label: "ATS",     val: c.atsScore,     color: "var(--green)" },
        { label: "Match",   val: c.similarityScore, color: "var(--blue)" },
        { label: "Fit",     val: c.jobFit,       color: "var(--amber)" },
    ].map(({ label, val, color }) => `
        <div class="modal-score-cell">
            <div class="modal-score-val" style="color:${color}">${val}%</div>
            <div class="modal-score-label">${label}</div>
        </div>
    `).join("");

    return `
        <div class="modal-hero">
            <div class="modal-candidate-name">${escHtml(c.name)}</div>
            <div class="modal-candidate-sub">
                <span>📅 ${c.experienceYears > 0 ? c.experienceYears + " yrs exp" : "Experience not stated"}</span>
                <span>🎓 ${c.educationLevel || "Edu not specified"}</span>
                ${c.certifications && c.certifications.length ? `<span>🏅 ${c.certifications.join(", ")}</span>` : ""}
            </div>
        </div>
        <div class="modal-scores">${scoreRow}</div>
        <div class="modal-tabs">${tabsHTML}</div>
        ${panelsHTML}
    `;
}

function infoCard(label, val, width) {
    return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px 14px;${width?'grid-column:1/-1':''}">
        <div style="font-family:var(--mono);font-size:0.65rem;color:var(--text-muted);margin-bottom:4px;">${label}</div>
        <div style="font-size:0.875rem;color:var(--text-dim);">${escHtml(String(val))}</div>
    </div>`;
}

function feedbackSection(title, items, cls) {
    if (!items || !items.length) return "";
    return `
        <div class="feedback-section ${cls}">
            <div class="feedback-section-title ${cls}">${title}</div>
            <ul class="feedback-list">${items.map(s => `<li>${escHtml(s)}</li>`).join("")}</ul>
        </div>
    `;
}

function contactCard(icon, label, val) {
    return `<div class="contact-item">
        <span class="contact-icon">${icon}</span>
        <div>
            <div style="font-family:var(--mono);font-size:0.62rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">${label}</div>
            <div class="contact-val ${val ? '' : 'missing'}">${val ? escHtml(val) : "Not found"}</div>
        </div>
    </div>`;
}

// ─── Export CSV ───────────────────────────────
function exportCSV() {
    if (!allCandidates.length) return;
    const headers = ["Rank","Name","Overall","ATS","Similarity","Job Fit","Completeness","Experience (yrs)","Education","Certifications","Matched Keywords","Missing Keywords","Tone","File"];
    const rows = allCandidates.map((c, i) => [
        i + 1,
        `"${c.name}"`,
        c.overallScore,
        c.atsScore,
        c.similarityScore,
        c.jobFit,
        c.completenessScore,
        c.experienceYears,
        `"${c.educationLevel || ''}"`,
        `"${(c.certifications || []).join('; ')}"`,
        `"${(c.matchedKeywords || []).join('; ')}"`,
        `"${(c.missingKeywords || []).slice(0,8).join('; ')}"`,
        c.tone,
        `"${c.filename || c.name}"`,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `recruitiq_results_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Utilities ────────────────────────────────
function showAlert(msg) {
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;top:20px;right:20px;z-index:9999;background:#1a1e28;border:1px solid #f87171;border-radius:8px;padding:12px 18px;color:#f87171;font-family:'JetBrains Mono',monospace;font-size:0.8rem;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:slideDown 0.2s ease";
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}

function escHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}
