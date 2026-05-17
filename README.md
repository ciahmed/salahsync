# 🌙 Salah Sync

Salah Sync is a premium, feature-rich, and visually stunning Islamic dashboard that provides real-time prayer times, a live digital Qibla compass, interactive Tasbeeh counter, dynamic scriptures, and customizable settings.

Designed with sleek glassmorphism, responsive grids, and professional HSL color palettes, Salah Sync offers a state-of-the-art spiritual companion on both mobile and desktop devices.

---

## ✨ Key Features

### 📅 Real-Time Prayer Times & Sound Blocked Adhan
* **Dynamic Fetching:** Uses the Aladhan API with the official **ISNA (Islamic Society of North America)** calculation method.
* **Automatic Adhan Playback:** Beautiful, configurable Adhan recitations (`adhan.mp3`, `adhan1.mp3`) trigger automatically when each prayer time sets in.
* **Inline Next Prayer Countdown:** Displays an automated, ticking countdown progress bar showing exactly how much time remains before the next prayer.
* **Sunset Card:** Includes a custom Sunset tracker next to Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha.

### ⚙️ Interactive Settings & Custom Configuration Panel
* **Jurisprudence Toggling:** Switch instantly between **Standard (Shafi'i, Maliki, Hanbali)** and **Hanafi** calculation methods (adjusts Asr timing dynamically).
* **Manual Offset Calibration:** Fine-tune timing offsets (+/- minutes) individually for each of the 7 daily prayer times.
* **Premium Theme Selector:** Toggle seamlessly between an immersive, high-glow **Dark Mode** and a clean, high-contrast **Light Mode**.
* **Persistent Cache:** Settings are saved locally to `localStorage` and persist automatically across device reloads.

### 🧭 Digital Qibla Compass
* **Cardinal Direction Markers:** Displays absolute **N, E, S, and W** markers for ideal spatial orientation.
* **Smart Device Orientation:** Integrates absolute compass hardware sensors for iOS Safari (`webkitCompassHeading` with secure permission prompts) and Android Chrome (`deviceorientationabsolute` auto-calibration).
* **Live Indicator:** Injects a glowing green active sensor status dot when mobile compass sensors are actively tracking.

### 📖 Daily Inspiration (Bilingual & Auto-Refreshed)
* **Ayat of the Day:** Pulls a completely random Quranic Verse live from the Alquran API in original Arabic Uthmani and Bangla translation.
* **Hadith of the Day:** Curates an offline-ready, high-fidelity library of authentic, inspiring Hadiths in English and Bangla.
* **Instant Rotations:** Scriptures refresh automatically on every single page load or app open to keep daily readings fresh and inspiring.

### 📿 Smart Tasbeeh Counter
* **Interactive Tapper:** Tap to log Dhikr instantly with large, readable numbers.
* **Storage Actions:** Click **Save** to persist your current session or **Reset** to start anew.

---

## 🛠️ Technology Stack

* **Structure:** HTML5 Semantic elements
* **Styling:** Vanilla CSS3 with custom HSL tokenized grids, backdrop glassmorphism, and responsive CSS variables.
* **Logic:** Clean, modular JavaScript (ES6+) with local storage cache, async geolocation fallbacks, and Web Audio API playback hooks.
* **APIs:**
  * **Prayer Times:** [Aladhan API](https://aladhan.com/prayer-times-api)
  * **Quran Verses:** [Alquran Cloud API](https://alquran.cloud/api)
  * **Weather Data:** [Open-Meteo API](https://open-meteo.com)

---

## 🚀 Easy Hosting on GitHub Pages

Salah Sync is 100% client-side static and runs perfectly on **GitHub Pages**! 

### Step-by-Step Manual Upload:
1. Go to **[github.com/new](https://github.com/new)** and create a new public repository named `salahsync`.
2. Check the box for **"Add a README file"** to initialize the repository.
3. Click the **Add file** dropdown button at the top right of your repository page and choose **Upload files**.
4. Drag and drop the following files from your `Project` folder:
   * `index.html`
   * `styles.css`
   * `app.js`
   * `README.md`
   * `adhan.mp3`
   * `adhan.ogg`
   * `adhan1.mp3`
5. Click **Commit changes**.
6. Navigate to **Settings** -> **Pages** -> **Branch**, select **`main`**, and click **Save**.
7. Your app is now live at: `https://YOUR_GITHUB_USERNAME.github.io/salahsync/`!

---

## 📄 License
This project is open-source and free to share, modify, and build upon. Made with 🌙 for Muslims worldwide.
