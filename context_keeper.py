"""
Context Keeper — LLM Conversation Handoff Tool
==============================================
Generate handoff prompts to seamlessly continue conversations across
different LLMs (ChatGPT, Gemini, Claude) when you hit token limits.

Built by: Kade (Karan Beldar)
Run: streamlit run context_keeper.py
"""

import streamlit as st
import json
import os
from datetime import datetime

# ============================================================
# CONFIG
# ============================================================
HISTORY_FILE = "handoff_history.json"

st.set_page_config(
    page_title="Context Keeper",
    page_icon="🔗",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ============================================================
# STYLING
# ============================================================
st.markdown("""
<style>
    .main-title {
        font-size: 2.8rem;
        font-weight: 800;
        background: linear-gradient(90deg, #FF6B35 0%, #F7931E 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0;
    }
    .subtitle {
        font-size: 1.1rem;
        color: #888;
        margin-top: 0;
        margin-bottom: 2rem;
    }
    .category-card {
        background: #1a1a1a;
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid #FF6B35;
        margin-bottom: 1rem;
    }
    .prompt-box {
        background: #0d1117;
        padding: 1.5rem;
        border-radius: 8px;
        border: 1px solid #30363d;
        font-family: 'Monaco', 'Courier New', monospace;
        font-size: 0.9rem;
        white-space: pre-wrap;
    }
    .step-number {
        display: inline-block;
        background: #FF6B35;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        text-align: center;
        line-height: 28px;
        font-weight: bold;
        margin-right: 8px;
    }
    .stButton>button {
        background: linear-gradient(90deg, #FF6B35 0%, #F7931E 100%);
        color: white;
        font-weight: 600;
        border: none;
        padding: 0.6rem 1.5rem;
    }
</style>
""", unsafe_allow_html=True)

# ============================================================
# PROMPT TEMPLATES
# ============================================================
PROMPTS = {
    "Coding": """We're approaching the chat limit. Before we run out, please create a COMPLETE CONTEXT HANDOFF that I can paste into another LLM (ChatGPT, Gemini, or Claude) to continue this work seamlessly.

Format your response EXACTLY like this:

═══════════════════════════════════════════
CONTEXT HANDOFF — Continuing Previous Session
═══════════════════════════════════════════

🎯 PROJECT
[1-2 lines: what we're building and the goal]

🛠️ TECH STACK
[Languages, frameworks, libraries, tools — be specific with versions if mentioned]

✅ PROGRESS COMPLETED
[Bullet points of what's already done and working]

💻 CURRENT CODE (VERBATIM)
[The latest working version of all relevant files — copy the full code exactly, don't summarize. Include filenames as headers.]

🐛 CURRENT PROBLEM
[The exact issue we were solving when this handoff was created — include error messages if any]

🧭 DECISIONS ALREADY MADE
[Important choices we made and WHY, so the next LLM doesn't suggest ideas we already rejected. Example: "Decided NOT to use X because Y"]

➡️ NEXT STEPS
[The specific next action I should take]

👤 ABOUT ME
[My experience level and how I like to work — e.g., "beginner, prefers step-by-step explanations, learning by doing"]

═══════════════════════════════════════════
INSTRUCTIONS FOR THE NEXT LLM:
Read everything above carefully. Acknowledge you understand the context, then continue from "NEXT STEPS" without re-explaining what we already covered.
═══════════════════════════════════════════

Please generate this handoff now using everything from our conversation.""",

    "Writing": """We're approaching the chat limit. Before we run out, please create a COMPLETE CONTEXT HANDOFF that I can paste into another LLM to continue this writing project seamlessly.

Format your response EXACTLY like this:

═══════════════════════════════════════════
CONTEXT HANDOFF — Continuing Writing Session
═══════════════════════════════════════════

📝 PROJECT
[What I'm writing: article, story, script, essay, etc. — and the topic]

🎯 PURPOSE & AUDIENCE
[Who this is for and what it should accomplish]

🎨 STYLE & TONE
[Voice, tone, length target, formality level — any specific style choices we agreed on]

✍️ CURRENT DRAFT (VERBATIM)
[The latest version of the text — full content, copied exactly]

💡 KEY IDEAS & ANGLES
[The main points, themes, or arguments we've developed]

🚫 DECISIONS ALREADY MADE
[Approaches we tried and rejected, things to AVOID — so the next LLM doesn't repeat them]

➡️ NEXT STEPS
[What needs to happen next: revise section X, add Y, polish Z]

👤 ABOUT ME
[My writing background and preferences]

═══════════════════════════════════════════
INSTRUCTIONS FOR THE NEXT LLM:
Read carefully, acknowledge the context, then continue the writing work from "NEXT STEPS".
═══════════════════════════════════════════

Please generate this handoff now.""",

    "Research": """We're approaching the chat limit. Before we run out, please create a COMPLETE CONTEXT HANDOFF that I can paste into another LLM to continue this research seamlessly.

Format your response EXACTLY like this:

═══════════════════════════════════════════
CONTEXT HANDOFF — Continuing Research Session
═══════════════════════════════════════════

🔍 RESEARCH TOPIC
[The core question or area I'm investigating]

🎯 GOAL
[What I'm trying to learn, decide, or produce from this research]

📚 KEY FINDINGS SO FAR
[The main facts, insights, sources, and conclusions discovered]

🧩 OPEN QUESTIONS
[What's still unclear or needs more digging]

🔗 SOURCES MENTIONED
[Any papers, websites, books, or experts referenced]

🚫 RULED OUT
[Hypotheses or directions we've already considered and dismissed, with reasons]

➡️ NEXT STEPS
[The specific research direction or question to tackle next]

👤 ABOUT ME
[My background on this topic and depth of expertise desired]

═══════════════════════════════════════════
INSTRUCTIONS FOR THE NEXT LLM:
Read carefully, acknowledge the context, then continue the research from "NEXT STEPS".
═══════════════════════════════════════════

Please generate this handoff now.""",
}

CATEGORY_INFO = {
    "Coding": ("💻", "For programming projects — preserves code, decisions, and bugs"),
    "Writing": ("✍️", "For articles, stories, scripts — preserves draft, tone, and style"),
    "Research": ("🔍", "For deep dives — preserves findings, sources, and open questions"),
}

# ============================================================
# HISTORY MANAGEMENT
# ============================================================
def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_to_history(category, label, content):
    history = load_history()
    history.insert(0, {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "category": category,
        "label": label,
        "content": content,
    })
    history = history[:50]  # Keep last 50
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)

# ============================================================
# UI — HEADER
# ============================================================
st.markdown('<h1 class="main-title">🔗 Context Keeper</h1>', unsafe_allow_html=True)
st.markdown(
    '<p class="subtitle">Never lose your LLM conversation context again. '
    'Generate perfect handoff prompts to continue your work across ChatGPT, Gemini, and Claude.</p>',
    unsafe_allow_html=True
)

# ============================================================
# SIDEBAR — HISTORY & GUIDE
# ============================================================
with st.sidebar:
    st.header("📖 Quick Guide")
    st.markdown("""
    **The trick:** Before your free chat hits the limit, ask the current LLM 
    to summarize itself into a handoff. Paste that into the next LLM and pick up where you left off.
    
    **Workflow:**
    1. Pick a category below
    2. Copy the generated prompt
    3. Send it to your current LLM
    4. Copy its handoff response
    5. Paste into the new LLM
    6. ✨ Continue seamlessly
    """)
    
    st.divider()
    st.header("🕓 Recent Handoffs")
    history = load_history()
    if not history:
        st.info("Saved prompts will appear here.")
    else:
        for i, item in enumerate(history[:10]):
            with st.expander(f"{item['category']} · {item['label']} · {item['timestamp']}"):
                st.code(item["content"], language=None)
        if st.button("🗑️ Clear History"):
            if os.path.exists(HISTORY_FILE):
                os.remove(HISTORY_FILE)
            st.rerun()

# ============================================================
# MAIN — TABS
# ============================================================
tab1, tab2 = st.tabs(["🎯 Generate Handoff Prompt", "❓ How To Use"])

# ----- TAB 1: GENERATE -----
with tab1:
    st.subheader("Step 1 — Pick your work type")
    
    cols = st.columns(3)
    for idx, (cat, (icon, desc)) in enumerate(CATEGORY_INFO.items()):
        with cols[idx]:
            st.markdown(
                f'<div class="category-card"><h3>{icon} {cat}</h3>'
                f'<p style="color:#aaa; font-size:0.9rem; margin:0;">{desc}</p></div>',
                unsafe_allow_html=True
            )
    
    category = st.radio(
        "Select category:",
        options=list(PROMPTS.keys()),
        horizontal=True,
        label_visibility="collapsed",
    )
    
    st.divider()
    
    st.subheader("Step 2 — Optional: Add a label to save this handoff")
    label = st.text_input(
        "Label (e.g., 'KYC website project', 'Resume rewrite')",
        placeholder="Leave blank if you don't want to save it",
    )
    
    st.divider()
    
    st.subheader("Step 3 — Your handoff prompt")
    prompt = PROMPTS[category]
    
    st.markdown(f'<div class="prompt-box">{prompt}</div>', unsafe_allow_html=True)
    
    col_a, col_b, col_c = st.columns([1, 1, 2])
    with col_a:
        # Streamlit's code block has a built-in copy button
        with st.expander("📋 Copy-ready version"):
            st.code(prompt, language=None)
    
    with col_b:
        if st.button("💾 Save to History", use_container_width=True):
            save_label = label.strip() if label.strip() else f"{category} handoff"
            save_to_history(category, save_label, prompt)
            st.success("Saved!")
            st.rerun()
    
    st.divider()
    
    st.subheader("Step 4 — Open your target LLM")
    st.write("Paste the prompt into your current LLM, then take its response to one of these:")
    
    link_cols = st.columns(3)
    with link_cols[0]:
        st.link_button("💬 Open ChatGPT", "https://chat.openai.com", use_container_width=True)
    with link_cols[1]:
        st.link_button("✨ Open Gemini", "https://gemini.google.com", use_container_width=True)
    with link_cols[2]:
        st.link_button("🤖 Open Claude", "https://claude.ai", use_container_width=True)

# ----- TAB 2: HOW TO USE -----
with tab2:
    st.subheader("The Full Workflow")
    
    st.markdown("""
    <div style="background:#1a1a1a; padding:1.5rem; border-radius:8px;">
    
    <p><span class="step-number">1</span> <b>Notice the warning signs.</b> 
    Your chat is getting long, responses are slowing, or you see "approaching limit" messages.</p>
    
    <p><span class="step-number">2</span> <b>Pick a category</b> in the Generate tab based on what you're working on.</p>
    
    <p><span class="step-number">3</span> <b>Copy the generated prompt</b> from the box.</p>
    
    <p><span class="step-number">4</span> <b>Paste it into your dying chat.</b> The LLM will produce a structured handoff with all your context preserved.</p>
    
    <p><span class="step-number">5</span> <b>Copy the LLM's handoff response.</b></p>
    
    <p><span class="step-number">6</span> <b>Open a fresh chat in any LLM</b> (ChatGPT, Gemini, Claude — use the buttons above).</p>
    
    <p><span class="step-number">7</span> <b>Paste the handoff as your first message.</b> The new LLM will pick up exactly where the last one left off.</p>
    
    </div>
    """, unsafe_allow_html=True)
    
    st.divider()
    
    st.subheader("Why This Works")
    st.markdown("""
    LLMs don't have memory across sessions or platforms — but they're excellent at *summarizing themselves* 
    when you ask the right way. This tool gives you that "right way" in three pre-tested formats:
    
    - **Coding** preserves your actual code verbatim so nothing breaks
    - **Writing** preserves your draft and tone so your voice stays consistent  
    - **Research** preserves your sources and dismissed paths so you don't go in circles
    
    The trick is being **proactive** — ask for the handoff *before* the chat dies, not after.
    """)
    
    st.divider()
    
    st.subheader("Pro Tips")
    st.markdown("""
    - 💡 **Save handoffs you reuse often** (e.g., "weekly research check-in") so you don't regenerate them
    - 💡 **Customize the prompts** to your style — fork the code and edit `PROMPTS` in `context_keeper.py`
    - 💡 **Mid-project switch** also works: even if you're not hitting limits, you can use this to get a fresh perspective from a different LLM
    - 💡 **Combine LLMs strategically**: brainstorm in one, refine in another, polish in a third
    """)

# ============================================================
# FOOTER
# ============================================================
st.divider()
st.markdown(
    '<p style="text-align:center; color:#666; font-size:0.85rem;">'
    'Built by Kade · Open source · '
    '<a href="https://github.com" style="color:#FF6B35;">View on GitHub</a>'
    '</p>',
    unsafe_allow_html=True
)
