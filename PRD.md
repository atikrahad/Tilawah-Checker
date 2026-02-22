# Project Requirements Document (PRD): Quran Recitation Checker

## 1. Project Overview
A web-based platform that allows users to recite Quranic Surahs and receive immediate **text-based feedback** on their accuracy. The tool compares live voice input against a verified "readymade" online database and provides parallel audio support for learning.

---

## 2. Target Audience
* Students of Hifz (Memorization).
* Beginners learning correct word pronunciation.
* Self-learners who want to check their recitation without a physical teacher.

---

## 3. Functional Requirements

### **3.1 Surah Selection & Database Integration**
* **Source:** Integrate with the **Quran.com API (v4)**.
* **Data Points:** Fetch Uthmani script text, Ayah translations, and audio file URLs (e.g., Mishary Rashid Alafasy).
* **Listing:** Provide a searchable list of all 114 Surahs.

### **3.2 Voice-to-Text Engine (Non-AI)**
* **Technology:** Use the **Web Speech API** (`webkitSpeechRecognition`).
* **Language Support:** Hardcoded to Arabic (`ar-SA`).
* **Real-time Streaming:** Display the user's spoken words on the screen as they talk.

### **3.3 Comparison Logic (The "Checker")**
* **Normalization:** Strip all *Tashkeel* (vowels/Fatha/Damma/Kasra) from both the user's input and the database text before comparing to ensure higher matching accuracy.
* **Visual Feedback:** * **Green:** Correct words.
    * **Red:** Incorrect or skipped words.
* **Text Explanations:** Display a tooltip or sub-text explaining the error (e.g., "Word mismatch" or "Extra word detected").

### **3.4 Parallel Audio Playback**
* **Reference Audio:** A "Play" button next to each Ayah to hear the professional reciter from the database.
* **Sync Mode:** (Optional) Ability to play the database audio at low volume while the user recites.

---

## 4. Technical Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | **Next.js 14+** (App Router, Tailwind CSS) |
| **Backend** | **NestJS** (Node.js framework) |
| **API** | **Quran.com API v4** (REST) |
| **Voice Processing** | **Web Speech API** (Built into Chrome/Safari) |
| **Deployment** | **Vercel** (Frontend) & **Railway/Render** (Backend) |

---

## 5. User Flow
1.  **Landing:** User selects a Surah (e.g., Surah Al-Fatiha).
2.  **Preparation:** User sees the first Ayah in large Uthmani script.
3.  **Action:** User clicks the **"🎤 Recite"** button.
4.  **Processing:** * User says: *"Alhamdu lillah"*
    * Browser converts to: `"الحمد لله"`
    * Backend checks against Database: `"الحمد لله"`
5.  **Result:** The text turns **Green**. If the user said something else, it turns **Red** and shows the correct text.
6.  **Assistance:** If the user is confused, they click **"🔊 Listen"** to hear the correct pronunciation.

---

## 6. Success Metrics
* **Zero Cost:** System must run without expensive AI API credits (using Browser API).
* **Latency:** Text feedback should appear within < 1 second of finishing an Ayah.
* **Accuracy:** Successful word-matching rate of 85% for clear speakers.

---

## 7. Future Scalability
* **Progress Tracking:** Using NestJS + PostgreSQL to save which Surahs the user has mastered.
* **Tajweed AI:** Migrating to a specialized Model (like Tarteel's Whisper) for advanced Tajweed checking (Madd, Ghunnah).

---